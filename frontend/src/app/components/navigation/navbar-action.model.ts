export interface NavbarAction {
  label?: string;
  labelKey?: string;
  icon?: string;
  variant?: 'flat' | 'stroked' | 'icon';
  action: () => void;
  visible?: boolean;
  disabled?: boolean;
}

export interface NavbarBreadcrumb {
  label?: string;
  labelKey?: string;
  route?: string | any[];
  clickable?: boolean;
}
