const {
  S3Client,
  PutObjectCommand,
  ListObjectsCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const REGION = process.env.AWS_REGION || "us-east-2";
const S3_BUCKET =
  process.env.S3_BUCKET || "dev-app-storage-f3c86bbf0763e1d5c007a15c33";

const client = new S3Client({ region: REGION });

/**
 *
 * @param {string} fileName
 * @param {File} file
 * @param {string} contentType
 * @param {string} category
 */
const uploadFile = async (fileName, file, contentType, category) => {
  try {
    const input = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Body: file,
      ContentType: contentType,
      Metadata: {
        category: category
      }
    };
    console.log(input);
    const command = new PutObjectCommand(input);
    return await client.send(command);
  } catch (error) {
    console.error("Error at upload file S3-Bucket:", error);
  }
};

module.exports = { uploadFile };
