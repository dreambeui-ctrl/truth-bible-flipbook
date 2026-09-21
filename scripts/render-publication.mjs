import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const sourceArg = process.argv[2];
const outputArg = process.argv[3] ?? 'public/publication/pages';

if (!sourceArg) {
  console.error(
    'Usage: pnpm render:publication /absolute/path/to/publication.pdf [output-directory]',
  );
  process.exit(1);
}

const sourcePdf = resolve(sourceArg);
const outputDirectory = resolve(outputArg);
const publicationDirectory = resolve(outputDirectory, '..');
const scratchDirectory = await mkdtemp(join(tmpdir(), 'truth-bible-pages-'));
const rasterPrefix = join(scratchDirectory, 'page');
const pdftoppm = process.env.PDFTOPPM ?? 'pdftoppm';

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} exited with status ${code}`));
      }
    });
  });
}

try {
  await mkdir(outputDirectory, { recursive: true });

  for (const file of await readdir(outputDirectory)) {
    if (/^page-\d{3}\.webp$/.test(file)) {
      await unlink(join(outputDirectory, file));
    }
  }

  console.log('Rendering publication pages…');
  await run(pdftoppm, [
    '-png',
    '-scale-to-x',
    '1600',
    '-scale-to-y',
    '-1',
    sourcePdf,
    rasterPrefix,
  ]);

  const rasterPages = (await readdir(scratchDirectory))
    .filter((file) => file.endsWith('.png'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (rasterPages.length === 0) {
    throw new Error('No pages were rendered from the source PDF.');
  }

  let pageWidth = 0;
  let pageHeight = 0;

  for (const [index, rasterPage] of rasterPages.entries()) {
    const outputName = `page-${String(index + 1).padStart(3, '0')}.webp`;
    const outputPath = join(outputDirectory, outputName);
    const pipeline = sharp(join(scratchDirectory, rasterPage)).webp({
      quality: 86,
      effort: 5,
      smartSubsample: true,
    });

    await pipeline.toFile(outputPath);

    if (index === 0) {
      const metadata = await sharp(outputPath).metadata();
      pageWidth = metadata.width ?? 1600;
      pageHeight = metadata.height ?? 2264;
    }

    process.stdout.write(`\rOptimized ${index + 1}/${rasterPages.length} pages`);
  }

  process.stdout.write('\n');

  const pages = rasterPages.map((_, index) => ({
    number: index + 1,
    src: `/publication/pages/page-${String(index + 1).padStart(3, '0')}.webp`,
  }));

  const manifest = {
    title: 'Truth Bible',
    edition: '2026',
    pageCount: pages.length,
    pageWidth,
    pageHeight,
    aspectRatio: Number((pageWidth / pageHeight).toFixed(6)),
    pdfUrl: null,
    pages,
  };

  await writeFile(
    join(publicationDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`Created ${pages.length} optimized pages and manifest.json.`);
} finally {
  await rm(scratchDirectory, { recursive: true, force: true });
}
