import multer from "multer";

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
      if (file.mimetype.startsWith('image/')) return callback(null, true);
      const error = new Error('Only image files are allowed');
      error.status = 400;
      callback(error);
    },
})

export default upload
