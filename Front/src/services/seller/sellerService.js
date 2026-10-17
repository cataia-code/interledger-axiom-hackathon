import { request, queryPath, collectPages } from '../api/client';
export const sellerService = {
  getOrganization: () => request('/seller/organization'),
  updateOrganization: body => request('/seller/organization', { method: 'PATCH', body }),
  getStore: (options = {}) => request('/seller/store', options),
  updateStore: body => request('/seller/store', { method: 'PATCH', body }),
  uploadStoreImage(kind, file) {
    if (!['icon', 'banner'].includes(kind)) throw new Error('Tipo de imagen de tienda inválido.');
    const body = new FormData(); body.append('image', file);
    return request(`/seller/store/${kind}`, { method: 'PUT', body });
  },
  deleteStoreImage(kind) {
    if (!['icon', 'banner'].includes(kind)) throw new Error('Tipo de imagen de tienda inválido.');
    return request(`/seller/store/${kind}`, { method: 'DELETE' });
  },
  listItems: query => request(queryPath('/seller/items', query)),
  getItem: (id, options = {}) => request(`/seller/items/${encodeURIComponent(id)}`, options),
  getCategories: (options = {}) => request('/seller/categories', options),
  createItem: body => request('/seller/items', { method: 'POST', body }),
  updateItem: (id, body) => request(`/seller/items/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  uploadItemImage: (id, image) => {
    const body = new FormData(); body.append('image', image);
    return request(`/seller/items/${encodeURIComponent(id)}/images`, { method: 'POST', body });
  },
  listOrders: query => request(queryPath('/seller/orders', query)),
  listAllOrders: () => collectPages('/seller/orders', 'orders'),
  listAllItems: () => collectPages('/seller/items', 'items'),
  getOrder: id => request(`/seller/orders/${encodeURIComponent(id)}`),
  updateOrderStatus: (id, status, note) => request(`/seller/orders/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, note } }),
};
