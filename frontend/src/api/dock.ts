
import api from './axios';

export interface DockPlanEntry {
    id: string;
    part_family: string;
    month: string;
    year: number;
    week_1_plan: boolean;
    week_1_audit_id?: string;
    week_2_plan: boolean;
    week_2_audit_id?: string;
    week_3_plan: boolean;
    week_3_audit_id?: string;
    week_4_plan: boolean;
    week_4_audit_id?: string;
}

export const dockApi = {
    getPlan: async (year: number) => {
        const response = await api.get(`/dock-plan?year=${year}`);
        return response.data;
    },

    updatePlan: async (part_family: string, month: string, year: number, week: number, is_planned: boolean, planned_day?: number) => {
        const response = await api.post('/dock-plan', { part_family, month, year, week, is_planned, planned_day });
        return response.data;
    },

    linkAudit: async (part_family: string, month: string, year: number, week: number, audit_id: string) => {
        const response = await api.post('/dock-plan/link-audit', { part_family, month, year, week, audit_id });
        return response.data;
    },

    getProducts: async () => {
        const response = await api.get('/dock-plan/products');
        return response.data;
    },

    addProduct: async (product_name: string) => {
        const response = await api.post('/dock-plan/products', { product_name });
        return response.data;
    },

    deleteProduct: async (product_name: string) => {
        const response = await api.delete(`/dock-plan/products/${encodeURIComponent(product_name)}`);
        return response.data;
    }
};
