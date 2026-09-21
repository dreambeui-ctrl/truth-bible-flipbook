import { createElement, type ImgHTMLAttributes } from 'react';

type StaticImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | { src: string };
  unoptimized?: boolean;
};

export default function StaticImage({
  src,
  unoptimized: _unoptimized,
  ...imageProps
}: StaticImageProps) {
  const imageSource = typeof src === 'string' ? src : src.src;
  return createElement('img', {
    ...imageProps,
    src: imageSource,
    alt: imageProps.alt ?? '',
  });
}
