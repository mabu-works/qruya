using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;
using QRCoder;

namespace Qruya
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }

    internal sealed class MainForm : Form
    {
        // 🔳 Web版（qruya）と同じ定数・仕様
        private const string MabusabaInvite = "https://discord.gg/GKkW4wCAVp";
        private const string UrlSample = "https://example.com/";
        private const int QuietZone = 4; // QRコード周囲の余白（モジュール数）

        private static readonly int[] Sizes = { 256, 512, 1024, 2048 };
        private static readonly QRCodeGenerator.ECCLevel[] EccLevels =
        {
            QRCodeGenerator.ECCLevel.L,
            QRCodeGenerator.ECCLevel.M,
            QRCodeGenerator.ECCLevel.Q,
            QRCodeGenerator.ECCLevel.H
        };
        private static readonly char[] EccChars = { 'L', 'M', 'Q', 'H' };

        private static readonly Color Bg = Color.FromArgb(10, 15, 28);
        private static readonly Color Surface = Color.FromArgb(17, 26, 46);
        private static readonly Color Panel2 = Color.FromArgb(24, 38, 66);
        private static readonly Color TextColor = Color.FromArgb(232, 238, 252);
        private static readonly Color Muted = Color.FromArgb(157, 177, 216);
        private static readonly Color Accent = Color.FromArgb(106, 141, 255);
        private static readonly Color ErrorColor = Color.FromArgb(255, 135, 135);

        private readonly TextBox inputText;
        private readonly ComboBox sizeBox;
        private readonly ComboBox eclBox;
        private readonly Panel fgSwatch;
        private readonly Panel bgSwatch;
        private readonly PictureBox preview;
        private readonly Label emptyLabel;
        private readonly Label statusLabel;
        private readonly Label errorLabel;
        private readonly Button downloadBtn;

        private Color fgColor = Color.Black;
        private Color bgColor = Color.White;
        private Bitmap? currentQr;

        public MainForm()
        {
            Text = "きゅるや for Windows｜QRコードメーカー";
            ClientSize = new Size(740, 620);
            MinimumSize = new Size(756, 659);
            BackColor = Bg;
            ForeColor = TextColor;
            Font = new Font("Yu Gothic UI", 10F);

            var title = new Label
            {
                Text = "きゅるや｜QRコードメーカー",
                Font = new Font("Yu Gothic UI", 16F, FontStyle.Bold),
                ForeColor = TextColor,
                Location = new Point(20, 14),
                AutoSize = true
            };
            Controls.Add(title);

            // ==========================================
            // ⌨️ 左側: 入力と設定
            // ==========================================
            var inputLabel = new Label
            {
                Text = "テキスト・URL",
                ForeColor = Muted,
                Location = new Point(20, 58),
                AutoSize = true
            };
            Controls.Add(inputLabel);

            inputText = new TextBox
            {
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                Location = new Point(20, 84),
                Size = new Size(330, 104),
                BackColor = Surface,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            inputText.TextChanged += (s, e) => Generate();
            Controls.Add(inputText);

            var urlPresetBtn = MakeSubButton("URLの例を入れる", 20, 198, 104);
            urlPresetBtn.Click += (s, e) => { inputText.Text = UrlSample; inputText.Focus(); };
            var invitePresetBtn = MakeSubButton("まぶ鯖の招待リンクを入れる", 130, 198, 130);
            invitePresetBtn.Click += (s, e) => { inputText.Text = MabusabaInvite; };
            var clearBtn = MakeSubButton("クリア", 266, 198, 84);
            clearBtn.Click += (s, e) => { inputText.Text = ""; inputText.Focus(); };
            Controls.Add(urlPresetBtn);
            Controls.Add(invitePresetBtn);
            Controls.Add(clearBtn);

            var sizeLabel = new Label { Text = "出力サイズ（PNG）", ForeColor = Muted, Location = new Point(20, 248), AutoSize = true };
            Controls.Add(sizeLabel);
            sizeBox = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Location = new Point(20, 274),
                Width = 200,
                BackColor = Surface,
                ForeColor = TextColor
            };
            sizeBox.Items.AddRange(new object[] { "256 × 256 px", "512 × 512 px", "1024 × 1024 px", "2048 × 2048 px" });
            sizeBox.SelectedIndex = 1;
            sizeBox.SelectedIndexChanged += (s, e) => Generate();
            Controls.Add(sizeBox);

            var eclLabel = new Label { Text = "誤り訂正レベル", ForeColor = Muted, Location = new Point(20, 316), AutoSize = true };
            Controls.Add(eclLabel);
            eclBox = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Location = new Point(20, 342),
                Width = 200,
                BackColor = Surface,
                ForeColor = TextColor
            };
            eclBox.Items.AddRange(new object[] { "L（約7%復元）", "M（約15%復元）", "Q（約25%復元）", "H（約30%復元）" });
            eclBox.SelectedIndex = 1;
            eclBox.SelectedIndexChanged += (s, e) => Generate();
            Controls.Add(eclBox);

            var fgLabel = new Label { Text = "前景色（模様の色）", ForeColor = Muted, Location = new Point(20, 384), AutoSize = true };
            Controls.Add(fgLabel);
            fgSwatch = MakeSwatch(20, 410, fgColor);
            var fgBtn = MakeSubButton("色を選ぶ", 62, 408, 100);
            fgBtn.Click += (s, e) => PickColor(true);
            Controls.Add(fgSwatch);
            Controls.Add(fgBtn);

            var bgLabel = new Label { Text = "背景色", ForeColor = Muted, Location = new Point(180, 384), AutoSize = true };
            Controls.Add(bgLabel);
            bgSwatch = MakeSwatch(180, 410, bgColor);
            var bgBtn = MakeSubButton("色を選ぶ", 222, 408, 100);
            bgBtn.Click += (s, e) => PickColor(false);
            Controls.Add(bgSwatch);
            Controls.Add(bgBtn);

            var note = new Label
            {
                Text = "日本語などの文字もUTF-8で符号化します。入力内容はこのアプリの中でのみ処理され、外部に送信されません。",
                ForeColor = Muted,
                Location = new Point(20, 452),
                Size = new Size(330, 64)
            };
            Controls.Add(note);

            // ==========================================
            // 👁️ 右側: プレビュー
            // ==========================================
            var previewLabel = new Label { Text = "プレビュー", ForeColor = Muted, Location = new Point(380, 58), AutoSize = true };
            Controls.Add(previewLabel);

            var previewPanel = new Panel
            {
                Location = new Point(380, 84),
                Size = new Size(340, 340),
                BackColor = Panel2,
                BorderStyle = BorderStyle.FixedSingle
            };
            preview = new PictureBox
            {
                Dock = DockStyle.Fill,
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Panel2
            };
            emptyLabel = new Label
            {
                Text = "テキストを入力すると、ここにQRコードが表示されます",
                ForeColor = Muted,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            };
            previewPanel.Controls.Add(preview);
            previewPanel.Controls.Add(emptyLabel);
            emptyLabel.BringToFront();
            Controls.Add(previewPanel);

            statusLabel = new Label
            {
                Text = "",
                ForeColor = Muted,
                Location = new Point(380, 434),
                Size = new Size(340, 44)
            };
            Controls.Add(statusLabel);

            errorLabel = new Label
            {
                Text = "",
                ForeColor = ErrorColor,
                Location = new Point(380, 478),
                Size = new Size(340, 44)
            };
            Controls.Add(errorLabel);

            var generateBtn = new Button
            {
                Text = "QRコードを作る",
                Font = new Font("Yu Gothic UI", 11F, FontStyle.Bold),
                BackColor = Accent,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(380, 540),
                Size = new Size(150, 38)
            };
            generateBtn.FlatAppearance.BorderSize = 0;
            generateBtn.Click += (s, e) =>
            {
                if (inputText.Text.Trim() == "")
                {
                    errorLabel.Text = "テキストを入力してください。";
                    inputText.Focus();
                    return;
                }
                Generate();
            };
            Controls.Add(generateBtn);

            downloadBtn = new Button
            {
                Text = "PNGでダウンロード",
                BackColor = Surface,
                ForeColor = TextColor,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(542, 540),
                Size = new Size(178, 38),
                Enabled = false
            };
            downloadBtn.Click += (s, e) => SavePng();
            Controls.Add(downloadBtn);

            Generate();
        }

        private Button MakeSubButton(string text, int x, int y, int width)
        {
            return new Button
            {
                Text = text,
                BackColor = Surface,
                ForeColor = TextColor,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(x, y),
                Size = new Size(width, 30),
                Font = new Font("Yu Gothic UI", 9F)
            };
        }

        private static Panel MakeSwatch(int x, int y, Color color)
        {
            return new Panel
            {
                Location = new Point(x, y),
                Size = new Size(34, 26),
                BackColor = color,
                BorderStyle = BorderStyle.FixedSingle
            };
        }

        private void PickColor(bool foreground)
        {
            using var dialog = new ColorDialog
            {
                Color = foreground ? fgColor : bgColor,
                FullOpen = true
            };
            if (dialog.ShowDialog(this) != DialogResult.OK) return;
            if (foreground)
            {
                fgColor = dialog.Color;
                fgSwatch.BackColor = fgColor;
            }
            else
            {
                bgColor = dialog.Color;
                bgSwatch.BackColor = bgColor;
            }
            Generate();
        }

        private int CurrentSize()
        {
            int i = sizeBox.SelectedIndex;
            return i >= 0 && i < Sizes.Length ? Sizes[i] : Sizes[1];
        }

        private QRCodeGenerator.ECCLevel CurrentEcl()
        {
            int i = eclBox.SelectedIndex;
            return i >= 0 && i < EccLevels.Length ? EccLevels[i] : QRCodeGenerator.ECCLevel.M;
        }

        private char CurrentEclChar()
        {
            int i = eclBox.SelectedIndex;
            return i >= 0 && i < EccChars.Length ? EccChars[i] : 'M';
        }

        // 🔳 Web版と同じ描画方式：クワイエットゾーン4モジュール、セルサイズは整数に切り捨てて中央寄せ
        private void Generate()
        {
            errorLabel.Text = "";
            statusLabel.Text = "";
            string text = inputText.Text;

            if (text.Trim() == "")
            {
                SetQrBitmap(null);
                downloadBtn.Enabled = false;
                if (text != "") errorLabel.Text = "テキストを入力してください。";
                return;
            }

            QRCodeData data;
            try
            {
                using var generator = new QRCodeGenerator();
                data = generator.CreateQrCode(text, CurrentEcl(), eciMode: QRCodeGenerator.EciMode.Utf8);
            }
            catch (Exception)
            {
                SetQrBitmap(null);
                downloadBtn.Enabled = false;
                errorLabel.Text = "入力が長すぎてQRコードに収まりません。文字を減らすか、誤り訂正レベルを下げてください。";
                return;
            }

            using (data)
            {
                int size = CurrentSize();
                int moduleCount = data.ModuleMatrix.Count;
                var bmp = new Bitmap(size, size);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.FillRectangle(new SolidBrush(bgColor), 0, 0, size, size);
                    int total = moduleCount + QuietZone * 2;
                    int cell = Math.Max(1, size / total);
                    int drawn = cell * total;
                    int offset = (size - drawn) / 2;
                    using var fgBrush = new SolidBrush(fgColor);
                    for (int row = 0; row < moduleCount; row++)
                    {
                        var rowData = data.ModuleMatrix[row];
                        for (int col = 0; col < moduleCount; col++)
                        {
                            if (rowData[col])
                            {
                                g.FillRectangle(fgBrush,
                                    offset + (col + QuietZone) * cell,
                                    offset + (row + QuietZone) * cell,
                                    cell, cell);
                            }
                        }
                    }
                }
                SetQrBitmap(bmp);
                downloadBtn.Enabled = true;
                statusLabel.Text = $"生成しました（{size} × {size} px、モジュール数 {moduleCount}、誤り訂正レベル {CurrentEclChar()}）。";
            }
        }

        private void SetQrBitmap(Bitmap? bmp)
        {
            var old = currentQr;
            currentQr = bmp;
            preview.Image = bmp;
            emptyLabel.Visible = bmp == null;
            if (bmp != null) preview.BringToFront();
            old?.Dispose();
        }

        private void SavePng()
        {
            if (currentQr == null) return;
            using var dialog = new SaveFileDialog
            {
                Filter = "PNG 画像|*.png",
                FileName = "qruya-qr.png",
                DefaultExt = "png"
            };
            if (dialog.ShowDialog(this) != DialogResult.OK) return;
            currentQr.Save(dialog.FileName, ImageFormat.Png);
            statusLabel.Text = "PNGを保存しました。";
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) currentQr?.Dispose();
            base.Dispose(disposing);
        }
    }
}
