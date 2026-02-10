
import api from './axios';

export const mfgApi = {
    getPlan: async (year: number) => {
        const response = await api.get(`/mfg-plan?year=${year}`);
        return response.data;
    },

    updatePlan: async (part_family: string, month: string, year: number, week: number, is_planned: boolean) => {
        const response = await api.post('/mfg-plan', { part_family, month, year, week, is_planned });
        return response.data;
    },

    getProducts: async () => {
        const response = await api.get('/mfg-plan/products');
        return response.data;
    },

    addProduct: async (product_name: string) => {
        const response = await api.post('/mfg-plan/products', { product_name });
        return response.data;
    },

    deleteProduct: async (product_name: string) => {
        const response = await api.delete(`/mfg-plan/products/${encodeURIComponent(product_name)}`);
        return response.data;
    }
};
