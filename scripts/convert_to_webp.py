#!/usr/bin/env python3
"""
convert_to_webp.py — converte imagens .jpg/.jpeg/.png para .webp

Uso:
    python3 convert_to_webp.py entrada.png
    python3 convert_to_webp.py entrada.jpg -o saida.webp
    python3 convert_to_webp.py entrada.jpeg -q 85
    python3 convert_to_webp.py pasta_com_imagens/ --recursive

Requer Pillow:
    pip install Pillow

Este script cobre os dois cenários do painel admin do site:
  1) a imagem já teve o fundo removido (remove.bg) e precisa virar .webp;
  2) a imagem foi adicionada sem remoção de fundo e ainda assim deve virar
     .webp antes de ser publicada no catálogo.
Em ambos os casos, a transparência (canal alpha) é preservada.
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow não está instalado. Rode: pip install Pillow --break-system-packages")

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def convert_one(input_path: Path, output_path: Path, quality: int) -> None:
    with Image.open(input_path) as img:
        # Preserva transparência quando existir (ex: fundo já removido);
        # converte pra RGB quando a imagem não tem canal alpha (ex: JPEG).
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path, "WEBP", quality=quality, method=6)
    print(f"OK: {input_path} -> {output_path} ({output_path.stat().st_size} bytes)")


def collect_inputs(path: Path, recursive: bool):
    if path.is_file():
        yield path
        return
    pattern = "**/*" if recursive else "*"
    for p in sorted(path.glob(pattern)):
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS:
            yield p


def main():
    parser = argparse.ArgumentParser(description="Converte imagens JPG/JPEG/PNG para WebP.")
    parser.add_argument("input", help="Arquivo de imagem ou pasta contendo imagens.")
    parser.add_argument("-o", "--output", help="Arquivo .webp de saída (só válido para um único arquivo de entrada).")
    parser.add_argument("-q", "--quality", type=int, default=90, help="Qualidade WebP, 0-100 (padrão: 90).")
    parser.add_argument("--recursive", action="store_true", help="Ao converter uma pasta, entra em subpastas também.")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.exit(f"Não encontrado: {input_path}")

    if input_path.is_file():
        if input_path.suffix.lower() not in VALID_EXTENSIONS:
            sys.exit(f"Extensão não suportada: {input_path.suffix} (use .jpg, .jpeg ou .png)")
        output_path = Path(args.output) if args.output else input_path.with_suffix(".webp")
        convert_one(input_path, output_path, args.quality)
        return

    if args.output:
        sys.exit("--output só pode ser usado com um único arquivo de entrada, não com uma pasta.")

    count = 0
    for f in collect_inputs(input_path, args.recursive):
        convert_one(f, f.with_suffix(".webp"), args.quality)
        count += 1
    print(f"\n{count} imagem(ns) convertida(s).")


if __name__ == "__main__":
    main()
