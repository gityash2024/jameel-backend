const aws = require('./aws');
const s3 = new aws.S3();

const uploadFile = async (params) => {
  return s3.upload(params).promise();
};

const deleteFile = async (params) => {
  return s3.deleteObject(params).promise();
};

const getSignedUrl = async (key, expiresIn = 3600) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: expiresIn  
  };
  return s3.getSignedUrlPromise('getObject', params);
};

module.exports = {
  uploadFile,
  deleteFile,
  getSignedUrl
};