import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? (() => { throw new Error("Missing required env S3_ENDPOINT"); })();
const S3_BUCKET = process.env.S3_BUCKET ?? (() => { throw new Error("Missing required env S3_BUCKET"); })();
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? (() => { throw new Error("Missing required env S3_ACCESS_KEY"); })();
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? (() => { throw new Error("Missing required env S3_SECRET_KEY"); })();

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

export async function getFileStream(key: string): Promise<{ stream: Readable; contentType: string }> {
  const resp = await s3.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }));
  return {
    stream: resp.Body as Readable,
    contentType: resp.ContentType || "application/octet-stream",
  };
}
