import type { Item, MenuItem, PageItem } from 'nextra/normalize-pages';
import { PRODUCTS_MENU_LIST } from '@theguild/components/products';

const meta: Record<string, DeepPartial<Item | MenuItem | PageItem>> = {
  index: {
    title: 'Home',
    type: 'page',
    display: 'hidden',
  },
  federation: {
    title: 'Federation',
    type: 'page',
    display: 'hidden',
  },
  hive: {
    title: 'Get Started',
    type: 'page',
    href: 'https://app.graphql-hive.com',
  },
  'contact-us': {
    title: 'Contact Us',
    type: 'page',
    href: 'https://the-guild.dev/contact',
  },
  status: {
    title: 'Status',
    type: 'page',
    href: 'https://status.graphql-hive.com',
  },
  docs: {
    title: 'Documentation',
    type: 'page',
    theme: {
      toc: true,
    },
  },
  products: {
    title: 'Products',
    type: 'menu',
    items: PRODUCTS_MENU_LIST,
  },
  pricing: {
    title: 'Pricing',
    type: 'page',
  },
  'product-updates': {
    type: 'page',
    title: 'Product Updates',
    theme: {
      sidebar: false,
      toc: true,
      breadcrumb: false,
      typesetting: 'article',
    },
  },
  'oss-friends': {
    type: 'page',
    title: 'Our Open Source Friends',
    display: 'hidden',
  },
  ecosystem: {
    title: 'Ecosystem',
    type: 'page',
  },
  blog: {
    title: 'Blog',
    type: 'page',
    href: 'https://the-guild.dev/blog',
  },
  github: {
    title: 'GitHub',
    type: 'page',
    href: 'https://github.com/graphql-hive/platform',
  },
  'the-guild': {
    title: 'The Guild',
    type: 'menu',
    items: {
      'about-us': {
        title: 'About Us',
        href: 'https://the-guild.dev/about-us',
        newWindow: true,
      },
      'brand-assets': {
        title: 'Brand Assets',
        href: 'https://the-guild.dev/logos',
        newWindow: true,
      },
    },
  },
  'graphql-foundation': {
    title: 'GraphQL Foundation',
    type: 'page',
    href: 'https://graphql.org/community/foundation/',
  },
};

export default meta;

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;