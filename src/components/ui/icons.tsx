import type { SVGProps } from 'react';

/**
 * Small inline icon set. Inline SVG keeps the bundle free of an icon library
 * and lets every icon inherit the current text colour.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={20}
      height={20}
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2 2 2 0 0 1 5 3h1.5Z" />
  </Icon>
);

export const WhatsAppIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 20.5 5 16.4A8 8 0 1 1 8 19.2l-4.5 1.3Z" />
    <path d="M9 9.5c.4 1.6 1.9 3.1 3.5 3.5l1-1 2 1v1.3c-2.6.5-5.9-2.3-6.8-4.8l1.3-.9Z" />
  </Icon>
);

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="17" cy="6" r="2.4" />
    <circle cx="17" cy="18" r="2.4" />
    <path d="m8.2 10.9 6.6-3.6M8.2 13.1l6.6 3.6" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.3" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const StarIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 9.6l5.2-.7L12 4Z" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14m0 0-6-6m6 6-6 6" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const FilterIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const GlobeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.4 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.4-3.3-8.5S9.8 5.9 12 3.5Z" />
  </Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 19 6v5.5c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V6l7-2.5Z" />
  </Icon>
);
