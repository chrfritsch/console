import { waitFor } from 'testkit/flow';
import { graphql } from 'testkit/gql';
import { ProjectType } from 'testkit/gql/graphql';
import { execute } from 'testkit/graphql';
import { initSeed } from 'testkit/seed';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'auto',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

const auditLogArray = graphql(`
  query GetAllAuditLogsArray($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        slug
        auditLogs {
          edges {
            node {
              __typename
            }
          }
        }
      }
    }
  }
`);

test.concurrent('Create multiple Audit Log Records for Organization', async ({ expect }) => {
  const { ownerToken, createOrg } = await initSeed().createOwner();
  await waitFor(5000);
  const { organization, createProject } = await createOrg();
  await waitFor(5000);
  await createProject(ProjectType.Single);
  await waitFor(4000);

  const result = await execute({
    document: auditLogArray,
    variables: {
      selector: {
        organizationSlug: organization.slug,
      },
    },
    authToken: ownerToken,
  });

  const auditLogs = result.rawBody.data?.organization?.organization.auditLogs.edges;

  expect(auditLogs?.length).toBe(5);
  expect(auditLogs?.length).not.toBe(0);
  expect(
    auditLogs?.find((log: any) => log.node.__typename === 'OrganizationCreatedAuditLog'),
  ).toBeDefined();
  expect(
    auditLogs?.find((log: any) => log.node.__typename === 'ProjectCreatedAuditLog'),
  ).toBeDefined();
  expect(
    auditLogs?.find((log: any) => log.node.__typename === 'TargetCreatedAuditLog'),
  ).toBeDefined();
});

const GetAuditLogs = graphql(`
  query GetAllAuditLogs($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        slug
        auditLogs {
          edges {
            node {
              id
              __typename
              eventTime
            }
          }
        }
      }
    }
  }
`);

test.concurrent('Create Audit Log Record for Organization', async ({ expect }) => {
  await waitFor(5000);
  const { createOrg, ownerToken } = await initSeed().createOwner();
  await waitFor(5000);
  const firstOrg = await createOrg();
  waitFor(15000);
  const result = await execute({
    document: GetAuditLogs,
    variables: {
      selector: {
        organizationSlug: firstOrg.organization.slug,
      },
    },
    authToken: ownerToken,
  });
  const auditLogs = result.rawBody.data?.organization?.organization.auditLogs.edges;
  waitFor(4000);
  expect(auditLogs?.[0].node.__typename === 'OrganizationCreatedAuditLog');
  expect(auditLogs?.[0].node.eventTime).toBeDefined();
});

const ExportAllAuditLogs = graphql(`
  mutation exportAllAuditLogs($selector: OrganizationSelectorInput!, $filter: AuditLogFilter!) {
    exportOrganizationAuditLog(selector: $selector, filter: $filter) {
      ok {
        url
      }
      error {
        message
      }
      __typename
    }
  }
`);

test.concurrent(
  'Try to export Audit Logs from an Organization with unauthorized user',
  async () => {
    await waitFor(5000);
    const { createOrg } = await initSeed().createOwner();
    await waitFor(5000);
    const firstOrg = await createOrg();
    await waitFor(5000);
    const secondOrg = await initSeed().createOwner();
    const secondToken = secondOrg.ownerToken;

    const exportAuditLogs = await execute({
      document: ExportAllAuditLogs,
      variables: {
        selector: {
          organizationSlug: firstOrg.organization.id,
        },
        filter: {
          startDate: '1960-12-31T22:00:00.000Z',
          endDate: '2023-12-31T22:00:00.000Z',
        },
      },
      token: secondToken,
    });

    expect(exportAuditLogs.rawBody.data?.exportOrganizationAuditLog.ok).toBeNull();
    expect(exportAuditLogs.rawBody.data?.exportOrganizationAuditLog.error).toBeDefined();
    expect(exportAuditLogs.rawBody.data?.exportOrganizationAuditLog.error?.message).toBe(
      'Unauthorized: You are not authorized to perform this action',
    );
  },
);

test.concurrent('Try to export Audit Logs from an Organization with authorized user', async () => {
  await waitFor(5000);
  const { createOrg, ownerToken } = await initSeed().createOwner();
  await waitFor(5000);
  const { createProject, organization } = await createOrg();
  await waitFor(5000);
  await createProject(ProjectType.Single);
  await waitFor(4000);

  const exportAuditLogs = await execute({
    document: ExportAllAuditLogs,
    variables: {
      selector: {
        organizationSlug: organization.id,
      },
      filter: {
        startDate: '1960-12-31T22:00:00.000Z',
        endDate: '2023-12-31T22:00:00.000Z',
      },
    },
    token: ownerToken,
  });

  const url = exportAuditLogs.rawBody.data?.exportOrganizationAuditLog.ok?.url;
  const parsedUrl = new URL(String(url));
  const pathParts = parsedUrl.pathname.split('/');
  const bucketName = pathParts[1];
  const key = pathParts.slice(2).join('/');
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const result = await s3Client.send(getObjectCommand);
  const bodyStream = await result.Body?.transformToString();
  expect(bodyStream).toBeDefined();

  const rows = bodyStream?.split('\n');
  expect(rows?.length).toBeGreaterThan(1); // At least header and one row
  const header = rows?.[0].split(',');
  const expectedHeader = ['id', 'created_at', 'event_type', 'user_id', 'user_email', 'metadata'];
  expect(header).toEqual(expectedHeader);
  expect(rows?.[1].split(',')[2]).toBe('TARGET_CREATED');
});
