import { Logger } from './logger';

/**
 * Convert image buffer to WebP format
 * @param buffer - Original image buffer
 * @param quality - WebP quality (1-100, default 85)
 * @returns WebP image buffer (Fallback: returns original buffer as sharp is removed)
 */
export async function convertToWebP(
    buffer: Buffer,
    quality: number = 85
): Promise<Buffer> {
    try {
        // sharp is removed to prevent build hangs and reduce memory usage.
        // Returning original buffer as a fallback.
        Logger.info('IMAGE_CONVERTED_TO_WEBP_BYPASSED', {
            originalSize: buffer.length,
            reason: 'Sharp removed for build stability'
        });

        return buffer;
    } catch (error: any) {
        Logger.error('WEBP_CONVERSION_FAILED', { error: error.message });
        return buffer;
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
 * Get file extension - returning original extension since WebP conversion is disabled
 */
export function getWebPExtension(): string {
    return 'jpg'; // Consistent with default uploads
}
