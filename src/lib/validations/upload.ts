import * as yup from 'yup';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const ALLOWED_PDF_TYPES = ['application/pdf'];
export const ALLOWED_MIXED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_MB = 5;

const isValidFile = (value: unknown): value is File => {
    return value instanceof File;
};

export const imageOnlyValidation = yup.mixed<File>()
    .test('is-file', 'File is required', (value) => {
        if (!value) return true;
        return isValidFile(value);
    })
    .test('file-type', 'Only JPG and PNG images are allowed', (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return ALLOWED_IMAGE_TYPES.includes(value.type);
    })
    .test('file-size', `File size must be less than ${MAX_FILE_SIZE_MB}MB`, (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return value.size <= MAX_FILE_SIZE;
    });

export const pdfOnlyValidation = yup.mixed<File>()
    .test('is-file', 'File is required', (value) => {
        if (!value) return true;
        return isValidFile(value);
    })
    .test('file-type', 'Only PDF files are allowed', (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return ALLOWED_PDF_TYPES.includes(value.type);
    })
    .test('file-size', `File size must be less than ${MAX_FILE_SIZE_MB}MB`, (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return value.size <= MAX_FILE_SIZE;
    });

export const imageOrPdfValidation = yup.mixed<File>()
    .test('is-file', 'File is required', (value) => {
        if (!value) return true;
        return isValidFile(value);
    })
    .test('file-type', 'Only PDF, JPG, and PNG files are allowed', (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return ALLOWED_MIXED_TYPES.includes(value.type);
    })
    .test('file-size', `File size must be less than ${MAX_FILE_SIZE_MB}MB`, (value) => {
        if (!value) return true;
        if (!isValidFile(value)) return false;
        return value.size <= MAX_FILE_SIZE;
    });

export const uploadFieldSchema = yup.object({
    file: yup.mixed<File>().required('File is required'),
    field: yup.string().required('Field is required').oneOf(['report_pdf', 'site_photography', 'site_clear_photo', 'other_attachment'], 'Invalid field type'),
    vardhiId: yup.string().uuid('Invalid Vardhi ID').required('Vardhi ID is required'),
});

export const sanitizeFilename = (filename: string): string => {
    const sanitized = filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '');
    
    const parts = sanitized.split('.');
    const ext = parts.pop()?.toLowerCase() || '';
    const name = parts.join('.');
    
    return `${name.substring(0, 100)}.${ext}`;
};

export const generateUniqueFilename = (
    originalName: string,
    field: string,
    companyId: string,
    vardhiId: string
): string => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const sanitized = sanitizeFilename(originalName);
    const ext = sanitized.split('.').pop() || 'bin';
    
    return `${field}_${companyId}_${vardhiId}_${timestamp}_${randomSuffix}.${ext}`;
};

export const validateFileType = (filename: string, allowedTypes: string[]): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        pdf: 'application/pdf',
    };
    
    const mimeType = mimeTypes[ext];
    return mimeType ? allowedTypes.includes(mimeType) : false;
};

export type UploadFieldData = yup.InferType<typeof uploadFieldSchema>;