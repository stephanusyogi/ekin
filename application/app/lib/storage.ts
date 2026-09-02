import fs from "fs";
import path from "path";

function getUploadDir() {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function saveFile(fileKey: string, buffer: Buffer | ArrayBuffer) {
  const uploadDir = getUploadDir();
  const filePath = path.join(uploadDir, fileKey);
  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }
  const content = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  await fs.promises.writeFile(filePath, content);
}

export async function getFile(fileKey: string): Promise<Buffer | null> {
  const uploadDir = getUploadDir();
  const filePath = path.join(uploadDir, fileKey);
  if (!fs.existsSync(filePath)) return null;
  return await fs.promises.readFile(filePath);
}

export async function deleteFile(fileKey: string) {
  const uploadDir = getUploadDir();
  const filePath = path.join(uploadDir, fileKey);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
