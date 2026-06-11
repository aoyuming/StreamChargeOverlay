using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

internal static class SingleExeLauncher
{
    private const string Magic = "SCZIP1__";
    private const string AppFolderName = "DNF赞助系统-WebView2";
    private const string AppExeName = "DNF赞助系统-WebView2.exe";

    [STAThread]
    private static int Main()
    {
        try
        {
            string selfPath = Process.GetCurrentProcess().MainModule.FileName;
            PackageInfo package = ReadPackageInfo(selfPath);
            string installRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "StreamChargeOverlay",
                "webview2"
            );
            string appPath = Path.Combine(installRoot, AppFolderName);
            string exePath = Path.Combine(appPath, AppExeName);
            string markerPath = Path.Combine(installRoot, "package.sha256");
            string packageHash = HashPackage(selfPath, package);

            if (NeedsInstall(exePath, markerPath, packageHash))
            {
                InstallPackage(selfPath, package, installRoot, appPath, markerPath, packageHash);
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = exePath,
                UseShellExecute = true
            });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "启动 DNF赞助系统 WebView2 失败：\r\n" + error.Message,
                "DNF赞助系统 WebView2",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }

    private static PackageInfo ReadPackageInfo(string selfPath)
    {
        using (FileStream stream = File.Open(selfPath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (stream.Length < 16)
            {
                throw new InvalidDataException("单文件包不完整");
            }

            byte[] footer = new byte[16];
            stream.Seek(-16, SeekOrigin.End);
            ReadExactly(stream, footer, 0, footer.Length);

            long packageLength = BitConverter.ToInt64(footer, 0);
            string magic = Encoding.ASCII.GetString(footer, 8, 8);
            long packageOffset = stream.Length - 16 - packageLength;

            if (magic != Magic || packageLength <= 0 || packageOffset <= 0)
            {
                throw new InvalidDataException("单文件包格式不正确");
            }

            return new PackageInfo(packageOffset, packageLength);
        }
    }

    private static bool NeedsInstall(string exePath, string markerPath, string packageHash)
    {
        if (!File.Exists(exePath) || !File.Exists(markerPath))
        {
            return true;
        }

        return File.ReadAllText(markerPath, Encoding.ASCII).Trim() != packageHash;
    }

    private static void InstallPackage(
        string selfPath,
        PackageInfo package,
        string installRoot,
        string appPath,
        string markerPath,
        string packageHash
    )
    {
        Directory.CreateDirectory(installRoot);

        if (Directory.Exists(appPath))
        {
            Directory.Delete(appPath, true);
        }

        string zipPath = Path.Combine(installRoot, "streamcharge-webview2.zip");
        CopyPackage(selfPath, package, zipPath);
        ZipFile.ExtractToDirectory(zipPath, installRoot);
        File.Delete(zipPath);
        File.WriteAllText(markerPath, packageHash, Encoding.ASCII);
    }

    private static string HashPackage(string selfPath, PackageInfo package)
    {
        using (SHA256 sha256 = SHA256.Create())
        using (FileStream input = File.Open(selfPath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            input.Seek(package.Offset, SeekOrigin.Begin);
            byte[] buffer = new byte[1024 * 1024];
            long remaining = package.Length;

            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = input.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new EndOfStreamException();
                }

                sha256.TransformBlock(buffer, 0, read, null, 0);
                remaining -= read;
            }

            sha256.TransformFinalBlock(new byte[0], 0, 0);
            return ToHex(sha256.Hash);
        }
    }

    private static void CopyPackage(string selfPath, PackageInfo package, string outputPath)
    {
        using (FileStream input = File.Open(selfPath, FileMode.Open, FileAccess.Read, FileShare.Read))
        using (FileStream output = File.Create(outputPath))
        {
            input.Seek(package.Offset, SeekOrigin.Begin);
            byte[] buffer = new byte[1024 * 1024];
            long remaining = package.Length;

            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = input.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new EndOfStreamException();
                }

                output.Write(buffer, 0, read);
                remaining -= read;
            }
        }
    }

    private static void ReadExactly(Stream stream, byte[] buffer, int offset, int count)
    {
        while (count > 0)
        {
            int read = stream.Read(buffer, offset, count);
            if (read <= 0)
            {
                throw new EndOfStreamException();
            }

            offset += read;
            count -= read;
        }
    }

    private static string ToHex(byte[] bytes)
    {
        StringBuilder builder = new StringBuilder(bytes.Length * 2);
        foreach (byte value in bytes)
        {
            builder.Append(value.ToString("x2"));
        }
        return builder.ToString();
    }

    private sealed class PackageInfo
    {
        public PackageInfo(long offset, long length)
        {
            Offset = offset;
            Length = length;
        }

        public long Offset { get; private set; }
        public long Length { get; private set; }
    }
}
