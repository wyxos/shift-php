export type ExternalRole = 'owner' | 'client_developer' | 'shift_lead_developer' | 'shift_developer' | 'user' | 'guest';

export interface RoleOption {
    value: string;
    label: string;
    group: string;
}

export interface ExternalUserRole {
    id: string | number;
    name: string;
    email: string;
    role?: ExternalRole | string | null;
    environment?: string | null;
}

export interface ExternalRolePagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface ExternalRoleResponse {
    capabilities?: {
        can_manage_external_roles?: boolean;
    };
    roles?: Array<string | Partial<RoleOption>>;
    users?: ExternalUserRole[];
    pagination?: Partial<ExternalRolePagination>;
}

export const fallbackRoles: ExternalRole[] = ['owner', 'client_developer', 'user', 'guest', 'shift_lead_developer', 'shift_developer'];
