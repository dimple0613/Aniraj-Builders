export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        approved_by_ranges?: any[];
    };
}

export function successResponse<T>(
    message: string,
    data?: T,
    pagination?: ApiResponse['pagination']
): ApiResponse<T> {
    return {
        success: true,
        message,
        ...(data !== undefined && { data }),
        ...(pagination && { pagination }),
    };
}

export function errorResponse(message: string): ApiResponse {
    return {
        success: false,
        message,
    };
}

export function unauthorizedResponse(): ApiResponse {
    return {
        success: false,
        message: 'Unauthorized company access',
    };
}

export function forbiddenResponse(message: string = 'Access denied'): ApiResponse {
    return {
        success: false,
        message,
    };
}
