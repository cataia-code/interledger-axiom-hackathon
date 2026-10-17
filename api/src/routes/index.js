import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { getPing } from '../controllers/pingController.js';
import { getMe, patchMe } from '../controllers/meController.js';
import * as meWallet from '../controllers/walletController.js';
import { getStore, listStores } from '../controllers/storeController.js';
import * as seller from '../controllers/sellerController.js';
import * as catalog from '../controllers/catalogController.js';
import * as orderCtl from '../controllers/orderController.js';
import * as paymentCtl from '../controllers/paymentController.js';
import { generalLimit, limiter } from '../middlewares/rateLimit.js';
import { uploadImage } from '../middlewares/upload.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(generalLimit);

router.get('/health', getHealth);
router.get('/ping', getPing);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, patchMe);
router.get('/me/wallets', requireAuth, meWallet.list);
router.post('/me/wallets', requireAuth, limiter(20), meWallet.create);
router.patch('/me/wallets/:id', requireAuth, limiter(20), meWallet.patch);
router.delete('/me/wallets/:id', requireAuth, meWallet.remove);
router.post('/payments/webhook/placeholder', limiter(300), paymentCtl.webhook);
router.get('/payments/openpayments/return/:orderId', limiter(60), paymentCtl.openPaymentsReturn);
router.get('/stores', listStores);
router.get('/stores/:id', getStore);
router.get('/stores/:id/categories', catalog.listStoreCategories);
router.get('/items', catalog.listItems);
router.get('/items/:id', catalog.getItem);

router.use(['/cart', '/orders'], requireAuth, requireRole('buyer'));
router.get('/cart', orderCtl.getCart);
router.delete('/cart', orderCtl.deleteCart);
router.put('/cart/items/:itemId', orderCtl.putCartItem);
router.delete('/cart/items/:itemId', orderCtl.deleteCartItem);
router.post('/orders', limiter(10), orderCtl.postOrder);
router.get('/orders', orderCtl.listMyOrders);
router.get('/orders/:id', orderCtl.getMyOrder);
router.post('/orders/:id/cancel', orderCtl.cancelMyOrder);
router.post('/orders/:id/pay', limiter(10), paymentCtl.postPayment);
router.get('/orders/:id/payments', paymentCtl.getMyPayments);

router.use('/seller', requireAuth, requireRole('seller'));
router.get('/seller/orders', orderCtl.listSellerOrders);
router.get('/seller/orders/:id', orderCtl.getSellerOrder);
router.post('/seller/orders/:id/status', orderCtl.postSellerTransition);
router.get('/seller/orders/:id/payments', paymentCtl.getStorePayments);
router.post('/seller/orders/:id/refunds', paymentCtl.postRefund);
router.get('/seller/organization', seller.getOrganization);
router.patch('/seller/organization', seller.patchOrganization);
router.get('/seller/store', seller.getOwnStore);
router.patch('/seller/store', seller.patchOwnStore);
router.delete('/seller/store', seller.deleteOwnStore);
router.put('/seller/store/banner', limiter(20), uploadImage, seller.putStoreImage('banner'));
router.delete('/seller/store/banner', seller.deleteStoreImage('banner'));
router.put('/seller/store/icon', limiter(20), uploadImage, seller.putStoreImage('icon'));
router.delete('/seller/store/icon', seller.deleteStoreImage('icon'));

router.get('/seller/categories', catalog.listOwnCategories);
router.post('/seller/categories', catalog.postCategory);
router.patch('/seller/categories/:id', catalog.patchCategory);
router.delete('/seller/categories/:id', catalog.removeCategory);

router.get('/seller/items', catalog.listOwnItems);
router.post('/seller/items', catalog.postItem);
router.get('/seller/items/:id', catalog.getOwnItem);
router.patch('/seller/items/:id', catalog.patchItem);
router.delete('/seller/items/:id', catalog.removeItem);
router.post('/seller/items/:id/discounts', catalog.postDiscount);
router.delete('/seller/items/:id/discounts/:discountId', catalog.removeDiscount);
router.get('/seller/items/:id/stock', catalog.getStock);
router.post('/seller/items/:id/stock', catalog.postStockMovement);
router.get('/seller/items/:id/stock-movements', catalog.getStockMovements);
router.post('/seller/items/:id/images', limiter(20), uploadImage, catalog.postImage);
router.put('/seller/items/:id/images/order', catalog.putImageOrder);
router.delete('/seller/items/:id/images/:imageId', catalog.removeImage);

export default router;
