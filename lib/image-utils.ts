import sharp from 'sharp';
import { Logger } from './logger';

/**
 * Convert image buffer to WebP format
 * @param buffer - Original image buffer
 * @param quality - WebP quality (1-100, default 85)
 * @returns WebP image buffer
 */
export async function convertToWebP(
    buffer: Buffer,
    quality: number = 85
): Promise<Buffer> {
    try {
        const webpBuffer = await sharp(buffer)
            .webp({ quality })
            .toBuffer();

        Logger.info('IMAGE_CONVERTED_TO_WEBP', {
            originalSize: buffer.length,
            webpSize: webpBuffer.length,
            compressionRatio: ((1 - webpBuffer.length / buffer.length) * 100).toFixed(2) + '%'
        });

        return webpBuffer;
    } catch (error: any) {
        Logger.error('WEBP_CONVERSION_FAILED', { error: error.message });
        throw new Error(`Failed to convert image to WebP: ${error.message}`);
    }
}

/**
 * Convert File to WebP format
 * @param file - Original File object
 * @param quality - WebP quality (1-100, default 85)
 * @returns WebP image buffer
 */
export async function convertFileToWebP(
    file: File,
    quality: number = 85
): Promise<Buffer> {
    const buffer = Buffer.from(await file.arrayBuffer());
    return convertToWebP(buffer, quality);
}

/**
 * Get file extension for WebP
 */
export function getWebPExtension(): string {
    return 'webp';
}
