import { Inject, Injectable, Scope } from 'graphql-modules';
import { sql, type DatabasePool } from 'slonik';
import zod from 'zod';
import { getLocalLang, getTokenSync } from '@nodesecure/i18n';
import * as jsxray from '@nodesecure/js-x-ray';
import { TargetSelectorInput } from '../../../__generated__/types.next';
import { Session } from '../../auth/lib/authz';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { PG_POOL_CONFIG } from '../../shared/providers/pg-pool';
import { Storage } from '../../shared/providers/storage';
import type { PreflightScriptModule } from './../__generated__/types';

const PreflightScriptModel = zod.strictObject({
  id: zod.string(),
  sourceCode: zod.string().max(5_000),
  targetId: zod.string(),
  createdByUserId: zod.union([zod.string(), zod.null()]),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

const scanner = new jsxray.AstAnalyser();
await getLocalLang();

function validateSourceCode(code: string) {
  try {
    const { warnings } = scanner.analyse(code);
    for (const warning of warnings) {
      const message = getTokenSync(jsxray.warnings[warning.kind].i18n);
      throw new Error(message);
    }
  } catch (error) {
    console.log({ error });
    return {
      error: {
        __typename: 'PreflightScriptError' as const,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

@Injectable({
  global: true,
  scope: Scope.Operation,
})
export class PreflightScriptProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private session: Session,
    private idTranslator: IdTranslator,
    @Inject(PG_POOL_CONFIG) private pool: DatabasePool,
  ) {
    this.logger = logger.child({ source: 'PreflightScriptProvider' });
  }

  async getPreflightScript(targetSlug: string) {
    const result = await this.pool.maybeOne(sql`/* getPreflightScript */
      SELECT "id"
           , "source_code"         as "sourceCode"
           , "target_id"           as "targetId"
           , "created_by_user_id"  as "createdByUserId"
           , to_json("created_at") as "createdAt"
           , to_json("updated_at") as "updatedAt"
      FROM "document_preflight_scripts"
      WHERE "target_id" = ${targetSlug}
      `);

    return result && PreflightScriptModel.parse(result);
  }

  async createPreflightScript(
    selector: TargetSelectorInput,
    { sourceCode }: PreflightScriptModule.CreatePreflightScriptInput,
  ) {
    const res = validateSourceCode(sourceCode);
    if (res) return res;

    const [organizationId, projectId, targetId] = await Promise.all([
      this.idTranslator.translateOrganizationId(selector),
      this.idTranslator.translateProjectId(selector),
      this.idTranslator.translateTargetId(selector),
    ]);

    await this.session.assertPerformAction({
      action: 'laboratory:createPreflightScript',
      organizationId,
      params: {
        organizationId,
        projectId,
        targetId,
      },
    });

    const target = await this.storage.getTarget({
      organizationId,
      projectId,
      targetId,
    });

    const currentUser = await this.session.getViewer();

    const result = await this.pool.maybeOne(sql`/* createPreflightScript */
      INSERT INTO "document_preflight_scripts" ( "source_code"
                                               , "target_id"
                                               , "created_by_user_id")
      VALUES (${sourceCode},
              ${targetId},
              ${currentUser.id})
      RETURNING
          "id"
          , "source_code" as "sourceCode"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

    const preflightScript = PreflightScriptModel.parse(result);

    return {
      ok: {
        __typename: 'PreflightScriptOkPayload' as const,
        preflightScript,
        updatedTarget: target,
      },
    };
  }

  async updatePreflightScript(
    selector: TargetSelectorInput,
    input: PreflightScriptModule.UpdatePreflightScriptInput,
  ) {
    const res = validateSourceCode(input.sourceCode);
    if (res) return res;

    const [organizationId, projectId, targetId] = await Promise.all([
      this.idTranslator.translateOrganizationId(selector),
      this.idTranslator.translateProjectId(selector),
      this.idTranslator.translateTargetId(selector),
    ]);

    await this.session.assertPerformAction({
      action: 'laboratory:updatePreflightScript',
      organizationId,
      params: {
        organizationId,
        projectId,
        targetId,
      },
    });

    const target = await this.storage.getTarget({
      organizationId,
      projectId,
      targetId,
    });

    const result = await this.pool.maybeOne(sql`/* updatePreflightScript */
      UPDATE
          "document_preflight_scripts"
      SET "source_code" = ${input.sourceCode}
        , "updated_at"  = NOW()
      WHERE "id" = ${input.id}
      RETURNING
          "id"
          , "source_code" as "sourceCode"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

    if (!result) {
      return {
        error: {
          __typename: 'PreflightScriptError' as const,
          message: 'No preflight script found',
        },
      };
    }

    const preflightScript = PreflightScriptModel.parse(result);

    return {
      ok: {
        __typename: 'PreflightScriptOkPayload' as const,
        preflightScript,
        updatedTarget: target,
      },
    };
  }
}
