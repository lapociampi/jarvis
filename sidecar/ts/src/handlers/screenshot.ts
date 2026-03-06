import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { RPCHandler } from '../types.js';

function run(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

export function createScreenshotHandler(): RPCHandler {
  return async () => {
    const platform = os.platform();
    const tmpFile = path.join(os.tmpdir(), `jarvis-screenshot-${Date.now()}.png`);

    try {
      if (platform === 'darwin') {
        await run(`screencapture -x ${tmpFile}`);
      } else if (platform === 'win32') {
        await run(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; ` +
            `[System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { ` +
            `$bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); ` +
            `$g = [System.Drawing.Graphics]::FromImage($bmp); ` +
            `$g.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); ` +
            `$bmp.Save('${tmpFile}') }"`,
        );
      } else {
        // Try scrot, then import (ImageMagick), then gnome-screenshot
        try {
          await run(`scrot ${tmpFile}`);
        } catch {
          try {
            await run(`import -window root ${tmpFile}`);
          } catch {
            await run(`gnome-screenshot -f ${tmpFile}`);
          }
        }
      }

      const data = await fs.readFile(tmpFile);
      const base64 = data.toString('base64');

      return {
        result: { captured: true },
        binary: { type: 'inline' as const, mime_type: 'image/png', data: base64 },
      };
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  };
}
