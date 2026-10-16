import multer from 'multer';
import { HttpError } from './errorHandler.js';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../services/imageService.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) =>
    ACCEPTED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Only JPEG, PNG or WebP images are accepted', 'INVALID_IMAGE_TYPE')),
}).single('image');

// Recibe una imagen en el campo "image" y traduce los errores de multer.
export function uploadImage(req, res, next) {
  parser(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'The image is larger than 5 MB', 'IMAGE_TOO_LARGE'));
    if (err instanceof multer.MulterError) return next(new HttpError(400, err.message, 'INVALID_UPLOAD'));
    return next(err);
  });
}
