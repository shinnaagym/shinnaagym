"use client";

import Image from "next/image";
import { useState } from "react";

export interface FacilityPhoto {
  src: string;
  alt: string;
}

/** "시설 소개" 섹션의 사진 슬라이드. 한 번에 한 장만 보여주고, 화살표·점
    인디케이터·좌우 스와이프로 넘길 수 있다. */
export function FacilityGallery({ photos }: { photos: FacilityPhoto[] }) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (photos.length === 0) return null;

  function go(delta: number) {
    setIndex((i) => (i + delta + photos.length) % photos.length);
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#1F2A24] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]"
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStartX === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX;
          if (delta > 40) go(-1);
          else if (delta < -40) go(1);
          setTouchStartX(null);
        }}
      >
        {photos.map((photo, i) => (
          <Image
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            fill
            quality={90}
            sizes="(min-width: 768px) 720px, 100vw"
            priority={i === 0}
            className={[
              "object-cover transition-opacity duration-500",
              i === index ? "opacity-100" : "opacity-0 pointer-events-none",
            ].join(" ")}
          />
        ))}

        <button
          type="button"
          aria-label="이전 사진"
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="다음 사진"
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55"
        >
          ›
        </button>

        <div className="absolute right-3 bottom-3 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
          {index + 1} / {photos.length}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`${i + 1}번째 사진으로 이동`}
            onClick={() => setIndex(i)}
            className={[
              "h-2 w-2 rounded-full transition",
              i === index ? "bg-[#8A6D3B]" : "bg-[#1F2A24]/20 hover:bg-[#1F2A24]/40",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
