#!/usr/bin/env python3
"""
Image region examination tool for geolocation analysis.
Crops and optionally enhances regions of interest.
"""

import argparse
from PIL import Image, ImageEnhance, ImageFilter
import sys


def crop_region(image_path: str, bbox: tuple, output_path: str) -> str:
    """
    Crop a region of interest from an image.
    
    Args:
        image_path: Path to source image
        bbox: Tuple of (left, upper, right, lower) coordinates
        output_path: Path for cropped output
    
    Returns:
        Path to the cropped image
    """
    img = Image.open(image_path)
    cropped = img.crop(bbox)
    cropped.save(output_path)
    return output_path


def crop_percentage(image_path: str, region: str, output_path: str) -> str:
    """
    Crop a named region (quadrant or section) from an image.
    
    Args:
        image_path: Path to source image
        region: One of: top-left, top-right, bottom-left, bottom-right,
                top-half, bottom-half, left-half, right-half, center
        output_path: Path for cropped output
    
    Returns:
        Path to the cropped image
    """
    img = Image.open(image_path)
    w, h = img.size
    
    regions = {
        'top-left': (0, 0, w//2, h//2),
        'top-right': (w//2, 0, w, h//2),
        'bottom-left': (0, h//2, w//2, h),
        'bottom-right': (w//2, h//2, w, h),
        'top-half': (0, 0, w, h//2),
        'bottom-half': (0, h//2, w, h),
        'left-half': (0, 0, w//2, h),
        'right-half': (w//2, 0, w, h),
        'center': (w//4, h//4, 3*w//4, 3*h//4),
    }
    
    if region not in regions:
        raise ValueError(f"Unknown region: {region}. Valid: {list(regions.keys())}")
    
    return crop_region(image_path, regions[region], output_path)


def enhance_for_text(image_path: str, output_path: str) -> str:
    """
    Enhance image for better text/sign readability.
    
    Args:
        image_path: Path to source image
        output_path: Path for enhanced output
    
    Returns:
        Path to the enhanced image
    """
    img = Image.open(image_path)
    
    # Increase contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    
    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)
    
    img.save(output_path)
    return output_path


def main():
    parser = argparse.ArgumentParser(description='Examine image regions for geolocation')
    parser.add_argument('image', help='Input image path')
    parser.add_argument('output', help='Output image path')
    parser.add_argument('--region', help='Named region to crop (e.g., top-left, center)')
    parser.add_argument('--bbox', nargs=4, type=int, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'),
                        help='Explicit bounding box coordinates')
    parser.add_argument('--enhance', action='store_true', help='Apply text enhancement')
    
    args = parser.parse_args()
    
    if args.bbox:
        result = crop_region(args.image, tuple(args.bbox), args.output)
    elif args.region:
        result = crop_percentage(args.image, args.region, args.output)
    else:
        # Just copy/enhance without cropping
        img = Image.open(args.image)
        img.save(args.output)
        result = args.output
    
    if args.enhance:
        result = enhance_for_text(result, args.output)
    
    print(f"Saved: {result}")


if __name__ == '__main__':
    main()
