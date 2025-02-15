const { uploadFile, deleteFile, getSignedUrl } = require('../../config/storage');

const uploadImage = async (file, folder) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${folder}/${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  const data = await uploadFile(params);
  return data.Location;
};

const deleteImage = async (url) => {
  const key = url.split('/').slice(-2).join('/');

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  };

  await deleteFile(params);
};

const getImageUrl = async (key) => {
  const url = await getSignedUrl(key);
  return url;
};

module.exports = {
  uploadImage,
  deleteImage,
  getImageUrl
};