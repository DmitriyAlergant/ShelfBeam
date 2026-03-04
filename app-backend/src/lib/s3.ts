import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env ${name}`);
  return val;
}

let _s3: S3Client | null = null;
let _bucket: string | null = null;

function getS3(): { client: S3Client; bucket: string } {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: getEnv("S3_ENDPOINT"),
      region: "us-east-1",
      credentials: {
        accessKeyId: getEnv("S3_ACCESS_KEY"),
        secretAccessKey: getEnv("S3_SECRET_KEY"),
      },
      forcePathStyle: getEnv("S3_FORCE_PATH_STYLE") === "true",
    });
    _bucket = getEnv("S3_BUCKET");
  }
  return { client: _s3, bucket: _bucket! };
}

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = getS3();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

export async function getFileStream(key: string): Promise<{ stream: Readable; contentType: string }> {
  const { client, bucket } = getS3();
  const resp = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  return {
    stream: resp.Body as Readable,
    contentType: resp.ContentType || "application/octet-stream",
  };
}
