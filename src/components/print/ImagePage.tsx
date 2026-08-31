interface ImagePageProps {
    images: string[];
    title?: string;
    imageType?: string;
}

const IMAGES_PER_PAGE = 9;

export function ImagePage({ images, title, imageType }: ImagePageProps) {
    if (!images || images.length === 0) {
        return null;
    }

    return (
        <div className="print-page image-page-container">
            {title && (
                <div className="image-section-header">
                    {title} ({images.length} Image{images.length > 1 ? 's' : ''})
                </div>
            )}
            <div className="image-grid">
                {images.map((src, index) => (
                    <div key={`${imageType || 'img'}-${index}`} className="image-item">
                        <img
                            src={src}
                            alt={`${imageType || 'Image'} ${index + 1}`}
                            className="print-image"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ImagePage;