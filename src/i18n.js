import {createI18n} from 'vue-i18n';

const catalog = {
  en: {
    '声谱首页': 'Vocal Score home', '文件仅在本机处理': 'Files are processed on this device', '切换深色主题': 'Switch to dark theme', '切换浅色主题': 'Switch to light theme', '深色': 'Dark', '浅色': 'Light', '界面语言': 'Interface language', '转换设置': 'Conversion settings', 'SVP 人声谱': 'SVP Vocal Score', '导入工程，生成五线谱与简谱。': 'Import a project to create staff notation and numbered notation.', '选择或拖入 SVP': 'Choose or drop SVP files', '支持同时导入多个 .svp 文件': 'Import multiple .svp files at once', '工程文件': 'Project files', '人声声部': 'Vocal parts', '全选': 'Select all', '谱面设置': 'Score settings', '乐谱标题': 'Score title', '节奏网格': 'Rhythm grid', '八分音符': 'Eighth notes', '十六分音符': 'Sixteenth notes', '三十二分音符': 'Thirty-second notes', '移调': 'Transpose', '降低半音': 'Lower by one semitone', '升高半音': 'Raise by one semitone', '半音': 'semitones', '目标音区': 'Target range', '较低 · C3–C5': 'Low · C3–C5', '中间 · G3–G5': 'Mid · G3–G5', '较高 · C4–C6': 'High · C4–C6', '自动移调': 'Auto-transpose', '调号只改变记谱方式；移调会改变音高。': 'A key signature changes notation; transposition changes pitch.', '节奏网格会整理音符的起止位置。': 'The rhythm grid adjusts note start and end times.', '字体与页面': 'Fonts and page', '谱面文字字体': 'Score text font', '宋体 / 衬线': 'Serif', '黑体 / 无衬线': 'Sans serif', '楷体': 'Kai style', '等宽': 'Monospaced', '歌词字号': 'Lyric size', '标题字号': 'Title size', '每页页眉': 'Header on each page', '可留空': 'Optional', '署名': 'Byline', '首页标题下方': 'Below the title on the first page', '页眉 / 署名字号': 'Header / byline size', '页码': 'Page numbers', '小节号': 'Measure numbers', '文字字体使用本机已安装字体；预览、打印和 SVG 同步。音乐符号保持标准制谱字体。': 'Text uses fonts installed on this device and stays consistent in previews, print, and SVG. Music notation keeps its standard notation font.', '声部整理': 'Part arrangement', '合并分散独唱': 'Merge separated solo passages', '不同声线中互不重叠的独唱片段，合并到上方；同时发声的音符保留分谱。': 'Non-overlapping solo passages from lower parts move to the part above; simultaneous notes remain separate.', '查看整理明细': 'View merge details', '本地转换 · 无需上传': 'Local conversion · no upload', '导入 SVP 开始制谱': 'Import an SVP to create a score', '人声总谱': 'Vocal score', '未导入工程': 'No project imported', '准备就绪': 'Ready', '五线谱': 'Staff notation', '简谱': 'Numbered notation', '打印 / PDF': 'Print / PDF', '导出 MusicXML': 'Export MusicXML', '记谱方式': 'Notation', '导出当前谱面 SVG ↗': 'Export current score as SVG ↗', '乐段与和声分析': 'Phrase and harmony analysis', '和弦是根据所选音轨推测的候选；匹配度不是正确率。重复段保留完整小节与歌词。': 'Chord labels are candidates inferred from selected parts; match is not accuracy. Repeated sections retain full measures and lyrics.', '重复乐段': 'Repeated phrases', '和弦候选': 'Chord candidates', '按小节': 'by measure', '歌词与声部文字': 'Lyrics and part text', '可修改或清空': 'Edit or clear', '单独的 - 表示延长前一个字。清空文字会保留音符；修改会写入导出的曲谱。': 'A lone - extends the previous syllable. Clearing text keeps the notes; edits are included in exported scores.', '音高微调': 'Pitch adjustment', '按音符音分和音高曲线中段的代表偏移修正半音，避免跟随短暂颤音。滑音、颤音参数单独列出；实际合成音高需要音频确认。': 'Adjust semitones from note detune and a representative value near the middle of pitch curves, avoiding brief vibrato. Portamento and vibrato parameters are listed separately; rendered audio is needed to confirm sounding pitch.', '正在排版乐谱…': 'Engraving score…', '乐谱预览': 'Score preview', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': 'Preserves pitch, lyrics, meter, and tempo; notes crossing barlines are tied automatically.', 'SVG 乐谱预览': 'SVG score preview', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'Enable JavaScript to parse projects and create scores locally.',
    '声部': 'Part', '声部 {count}': 'Part {count}', '未命名声部': 'Unnamed part', 'SVP {version} · {count} 个声部': 'SVP {version} · {count} parts', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': 'Measure {measure} · beat {beat}', '小节 {measure} · {beat} + {fraction} 拍': 'Measure {measure} · beat {beat} + {fraction}', '位置 {beats} 拍': 'Position {beats} beats', '{count} 音符': '{count} notes', '音域 {low}–{high} · {transpose} 半音。{message}': 'Range {low}–{high} · {transpose} semitones. {message}', '人声五线谱': 'Vocal staff score', '人声简谱': 'Vocal numbered notation', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output} parts; {count} notes moved upward', '{from} → {to}：{count} 个音符': '{from} → {to}: {count} notes', '存在重叠发声，可能为和声或叠唱': 'Overlapping voices; this may be harmony or doubled singing', '乐谱排版组件未能加载，请刷新页面后重试。': 'The score engraver failed to load. Refresh the page and try again.', '{parts} 声部 · {notes} 音符': '{parts} parts · {notes} notes', '{count} 小节': '{count} measures', '五线谱 · OpenSheetMusicDisplay': 'Staff notation · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': 'Numbered notation · scalable SVG', '请选择 .svp 工程文件。': 'Choose an .svp project file.', '文件超过 25 MB，请缩小工程后再导入。': 'The file exceeds 25 MB. Reduce the project size before importing.', '工程中没有可转换的人声音符。': 'The project has no vocal notes to convert.', '人声谱': 'Vocal Score', '调性推测：{key}，可手动修改。': 'Estimated key: {key}. You can change it manually.', '音高信息不足以确定调性，请手动选择调号。': 'Not enough pitch information to estimate a key. Choose a key signature manually.', '请选择含音符的人声声部。': 'Select a vocal part that contains notes.', '调性推测 {before} → {after}。': 'Estimated key {before} → {after}.', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}.', '仍有 {count} 个音符超出目标音区。': '{count} notes remain outside the target range.', '音符均在目标音区内。': 'All notes fit the target range.', '{repeats} 组重复 · {chords} 处和弦候选': '{repeats} repeated groups · {chords} chord candidates', '{label} · {length} 小节 × {count}': '{label} · {length} measures × {count}', '旋律与节奏相同，歌词有差异': 'Melody and rhythm match; lyrics differ', '旋律、节奏与歌词相同': 'Melody, rhythm, and lyrics match', '未检测到至少两个小节的完全重复乐段。': 'No exact repeated phrase of at least two measures was found.', '{measure} 小节 · {beat} 拍': 'Measure {measure} · beat {beat}', '{label}的推测和弦': 'Inferred chord for {label}', '{symbol} · 匹配 {percent}%': '{symbol} · {percent}% match', '不标注': 'No annotation', '同时发声': 'Simultaneous notes', '音符汇总': 'Note summary', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': 'There is not enough pitch evidence for reliable chord candidates. A solo melody cannot uniquely determine harmony.', '{adjusted} 个音符修正 · {detuned} 个音分微调': '{adjusted} notes adjusted · {detuned} with note detune', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': 'Project: {points} pitch-curve points, {curves} other pitch curves; {explicit} notes with explicit expression, {inherited} with inherited expression.', '代表偏移达到 {threshold} 音分时，按最近半音调整。100 音分 = 1 半音；剩余音分在下表显示，谱面使用半音音阶。': 'When the representative offset reaches {threshold} cents, adjust to the nearest semitone. 100 cents = 1 semitone; residual cents appear below, and the score uses chromatic semitones.', '自动半音修正已关闭，谱面使用原始音符加整体移调。': 'Automatic semitone correction is off; the score uses original notes plus global transposition.', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': 'Dynamic curves for {count} notes are reduced to a representative middle value; nonlinear curves use approximate sampling.', '来源声部 / 音符': 'Source part / note', '修正前': 'Before', '修正后': 'After', '代表偏移': 'Representative offset', '剩余音分': 'Residual cents', '{name} / {index}': '{name} / {index}', '显式': 'Explicit', '继承': 'Inherited', '声线': 'Voice', '查看滑音与颤音参数范围': 'View portamento and vibrato parameter ranges', '{name}：{low}–{high}（{count} 个音符）': '{name}: {low}–{high} ({count} notes)', '文件和设置保存在当前浏览器。': 'Files and settings are saved in this browser.', '本机浏览器数据被清除后无法恢复。': 'Saved content cannot be recovered if this browser’s data is cleared.', '清除浏览器数据会删除已存内容。': 'Clearing browser data deletes saved content.', '正在保存…': 'Saving…', '已保存在此浏览器': 'Saved in this browser', '保存失败': 'Save failed', '移除文件': 'Remove file', '已移除': 'Removed', '正在恢复文件…': 'Restoring files…', '未导入工程': 'No project imported', '正在恢复文件…': 'Restoring files…',
    '歌词与声部名称': 'Lyrics and part names', '清空本声部歌词': 'Clear lyrics in this part', '还原清空前内容': 'Restore lyrics before clearing', '修改会自动应用': 'Edits are applied automatically', '已修改': 'Edited', '选择声部': 'Select a part', '声部名称': 'Part name', '音符歌词': 'Note lyrics', '粘贴歌词文本': 'Paste lyrics', '粘贴文本处理方式': 'Pasted text mode', '处理方式': 'Mode', '拼音文本': 'Pinyin text', '汉字转拼音': 'Convert Hanzi to pinyin', '按全部音符对齐（包含空歌词位和延长位）': 'Align to every note (including empty lyric slots and extensions)', '应用替换': 'Apply replacement', '撤销上次替换': 'Undo last replacement', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': 'English is not accepted in Hanzi-to-pinyin mode. Switch to pinyin text mode.', '请粘贴中文汉字；英文文本不会转换。': 'Paste Chinese characters; English text is not converted.', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '{targets} notes to replace · {count} words pasted · counts match', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '{targets} notes to replace · {count} words generated · counts match', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '{targets} notes to replace · {count} words pasted · off by {difference}', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '{targets} notes to replace · {count} words generated · off by {difference}', '小节 {measure} · {beat}{fraction} 拍': 'Measure {measure} · beat {beat}{fraction}', '第 {index} 个音符歌词': 'Lyrics for note {index}', '清除第 {index} 个音符歌词': 'Clear lyrics for note {index}', '还原第 {index} 个音符歌词': 'Restore lyrics for note {index}', '时值 {duration}': 'Duration {duration}', '（空）': '(empty)', '（无对应音符）': '(no matching note)', '（缺少）': '(missing)', '仅预览前 {count} 项；总计 {total} 项。': 'Previewing {count} of {total} items.', '清除': 'Clear', '还原': 'Restore', '需要编辑容器和已解析的工程。': 'An editor container and parsed project are required.'
  },
  ja: {
    '声谱首页': 'Vocal Score ホーム', '文件仅在本机处理': 'ファイルはこの端末内で処理されます', '切换深色主题': 'ダークテーマに切り替え', '切换浅色主题': 'ライトテーマに切り替え', '深色': 'ダーク', '浅色': 'ライト', '界面语言': '表示言語', '转换设置': '変換設定', 'SVP 人声谱': 'SVP ボーカル譜', '导入工程，生成五线谱与简谱。': 'プロジェクトを読み込み、五線譜と数字譜を作成します。', '选择或拖入 SVP': 'SVP ファイルを選択またはドロップ', '支持同时导入多个 .svp 文件': '複数の .svp ファイルを同時に読み込めます', '工程文件': 'プロジェクトファイル', '人声声部': 'ボーカルパート', '全选': 'すべて選択', '谱面设置': '楽譜設定', '乐谱标题': '楽譜タイトル', '节奏网格': 'リズムグリッド', '八分音符': '8分音符', '十六分音符': '16分音符', '三十二分音符': '32分音符', '移调': '移調', '降低半音': '半音下げる', '升高半音': '半音上げる', '半音': '半音', '目标音区': '目標音域', '较低 · C3–C5': '低め · C3–C5', '中间 · G3–G5': '中間 · G3–G5', '较高 · C4–C6': '高め · C4–C6', '自动移调': '自動移調', '调号只改变记谱方式；移调会改变音高。': '調号は表記だけを変え、移調は音高を変えます。', '节奏网格会整理音符的起止位置。': 'リズムグリッドで音符の開始位置と終了位置を整えます。', '字体与页面': 'フォントとページ', '谱面文字字体': '譜面テキストのフォント', '宋体 / 衬线': '明朝体 / セリフ', '黑体 / 无衬线': 'ゴシック体 / サンセリフ', '楷体': '楷書体', '等宽': '等幅', '歌词字号': '歌詞サイズ', '标题字号': 'タイトルサイズ', '每页页眉': '各ページのヘッダー', '可留空': '任意', '署名': 'クレジット', '首页标题下方': '1ページ目のタイトル下', '页眉 / 署名字号': 'ヘッダー / クレジットのサイズ', '页码': 'ページ番号', '小节号': '小節番号', '文字字体使用本机已安装字体；预览、打印和 SVG 同步。音乐符号保持标准制谱字体。': '文字には端末にインストールされたフォントを使い、プレビュー・印刷・SVGで統一します。音楽記号には標準の記譜フォントを使います。', '声部整理': 'パート整理', '合并分散独唱': '分散した独唱をまとめる', '不同声线中互不重叠的独唱片段，合并到上方；同时发声的音符保留分谱。': '重ならない独唱部分を上のパートにまとめ、同時に鳴る音符は別パートに残します。', '查看整理明细': '整理の詳細を見る', '本地转换 · 无需上传': 'ローカル変換 · アップロード不要', '导入 SVP 开始制谱': 'SVP を読み込んで楽譜を作成', '人声总谱': 'ボーカル総譜', '未导入工程': 'プロジェクト未読み込み', '准备就绪': '準備完了', '五线谱': '五線譜', '简谱': '数字譜', '打印 / PDF': '印刷 / PDF', '导出 MusicXML': 'MusicXML を書き出す', '记谱方式': '記譜方式', '导出当前谱面 SVG ↗': '現在の楽譜を SVG で書き出す ↗', '乐段与和声分析': 'フレーズと和声の分析', '和弦是根据所选音轨推测的候选；匹配度不是正确率。重复段保留完整小节与歌词。': 'コードは選択したパートから推定した候補で、一致度は正解率ではありません。反復部分は小節と歌詞をそのまま保持します。', '重复乐段': '反復フレーズ', '和弦候选': 'コード候補', '按小节': '小節ごと', '歌词与声部文字': '歌詞とパート名', '可修改或清空': '編集または消去', '单独的 - 表示延长前一个字。清空文字会保留音符；修改会写入导出的曲谱。': '単独の「-」は前の音節を伸ばします。文字を消しても音符は残り、編集内容は書き出す楽譜に反映されます。', '音高微调': '音高の微調整', '按音符音分和音高曲线中段的代表偏移修正半音，避免跟随短暂颤音。滑音、颤音参数单独列出；实际合成音高需要音频确认。': '音符のセント値とピッチカーブ中央の代表値から半音を調整し、短いビブラートへの追従を避けます。ポルタメントとビブラートの値は別に表示します。実際の合成音高の確認には音声が必要です。', '正在排版乐谱…': '楽譜を組版中…', '乐谱预览': '楽譜プレビュー', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': '音高、歌詞、拍子、テンポを保持し、小節をまたぐ音符は自動でタイします。', 'SVG 乐谱预览': 'SVG 楽譜プレビュー', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'JavaScript を有効にすると、プロジェクトを端末内で解析して楽譜を作成できます。',
    '声部': 'パート', '声部 {count}': 'パート {count}', '未命名声部': '名前のないパート', 'SVP {version} · {count} 个声部': 'SVP {version} · {count} パート', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': '{measure} 小節 · {beat} 拍', '小节 {measure} · {beat} + {fraction} 拍': '{measure} 小節 · {beat} + {fraction} 拍', '位置 {beats} 拍': '位置 {beats} 拍', '{count} 音符': '{count} 音符', '音域 {low}–{high} · {transpose} 半音。{message}': '音域 {low}–{high} · {transpose} 半音。{message}', '人声五线谱': 'ボーカル五線譜', '人声简谱': 'ボーカル数字譜', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output} パート、{count} 音符を上へ統合', '{from} → {to}：{count} 个音符': '{from} → {to}：{count} 音符', '存在重叠发声，可能为和声或叠唱': '音が重なっています。和声またはダブリングの可能性があります', '乐谱排版组件未能加载，请刷新页面后重试。': '楽譜組版コンポーネントを読み込めません。ページを更新して再試行してください。', '{parts} 声部 · {notes} 音符': '{parts} パート · {notes} 音符', '{count} 小节': '{count} 小節', '五线谱 · OpenSheetMusicDisplay': '五線譜 · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': '数字譜 · 拡大縮小できる SVG', '请选择 .svp 工程文件。': '.svp プロジェクトファイルを選択してください。', '文件超过 25 MB，请缩小工程后再导入。': 'ファイルが25 MBを超えています。プロジェクトを小さくしてから読み込んでください。', '工程中没有可转换的人声音符。': '変換できるボーカル音符がありません。', '人声谱': 'ボーカル譜', '调性推测：{key}，可手动修改。': '推定調性：{key}。手動で変更できます。', '音高信息不足以确定调性，请手动选择调号。': '調性を推定するには音高情報が不足しています。調号を選択してください。', '请选择含音符的人声声部。': '音符のあるボーカルパートを選択してください。', '调性推测 {before} → {after}。': '推定調性 {before} → {after}。', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}。', '仍有 {count} 个音符超出目标音区。': '{count} 音符が目標音域の外に残っています。', '音符均在目标音区内。': 'すべての音符が目標音域内です。', '{repeats} 组重复 · {chords} 处和弦候选': '反復 {repeats} 組 · コード候補 {chords} 件', '{label} · {length} 小节 × {count}': '{label} · {length} 小節 × {count}', '旋律与节奏相同，歌词有差异': '旋律とリズムは同じで歌詞が異なります', '旋律、节奏与歌词相同': '旋律・リズム・歌詞が同じです', '未检测到至少两个小节的完全重复乐段。': '2小節以上の完全な反復フレーズは見つかりませんでした。', '{measure} 小节 · {beat} 拍': '{measure} 小節 · {beat} 拍', '{label}的推测和弦': '{label} の推定コード', '{symbol} · 匹配 {percent}%': '{symbol} · 一致度 {percent}%', '不标注': '注記なし', '同时发声': '同時発音', '音符汇总': '音符の集計', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': '信頼できるコード候補を出すには音高情報が不足しています。独唱の旋律だけでは和声を一意に決められません。', '{adjusted} 个音符修正 · {detuned} 个音分微调': '{adjusted} 音符を修正 · {detuned} 音符にデチューンあり', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': 'プロジェクト：ピッチカーブ点 {points}、その他のピッチカーブ {curves} 本。明示的な表現値を持つ音符 {explicit}、継承値を持つ音符 {inherited}。', '代表偏移达到 {threshold} 音分时，按最近半音调整。100 音分 = 1 半音；剩余音分在下表显示，谱面使用半音音阶。': '代表偏移が{threshold}セント以上の場合、最も近い半音に調整します。100セント＝1半音。残りのセント値は下表に表示されます。譜面は半音階表記です。', '自动半音修正已关闭，谱面使用原始音符加整体移调。': '自動半音補正はオフです。譜面には元の音符と全体移調を使います。', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': '{count} 音符の動的カーブは中央の代表値に簡略化されます。非線形カーブは近似サンプリングです。', '来源声部 / 音符': '元のパート / 音符', '修正前': '修正前', '修正后': '修正後', '代表偏移': '代表偏移', '剩余音分': '残りのセント', '{name} / {index}': '{name} / {index}', '显式': '明示', '继承': '継承', '声线': '声質', '查看滑音与颤音参数范围': 'ポルタメントとビブラートの値を見る', '{name}：{low}–{high}（{count} 个音符）': '{name}：{low}–{high}（{count} 音符）', '文件和设置保存在当前浏览器。': 'ファイルと設定はこのブラウザーに保存されます。', '本机浏览器数据被清除后无法恢复。': 'ブラウザーのデータを消去すると保存内容は復元できません。', '清除浏览器数据会删除已存内容。': 'ブラウザーのデータを消去すると保存内容が削除されます。', '正在保存…': '保存中…', '已保存在此浏览器': 'このブラウザーに保存しました', '保存失败': '保存に失敗しました', '移除文件': 'ファイルを削除', '已移除': '削除しました', '正在恢复文件…': 'ファイルを復元中…',
    '歌词与声部名称': '歌詞とパート名', '清空本声部歌词': 'このパートの歌詞を消去', '还原清空前内容': '消去前の歌詞に戻す', '修改会自动应用': '編集は自動で反映されます', '已修改': '編集済み', '选择声部': 'パートを選択', '声部名称': 'パート名', '音符歌词': '音符の歌詞', '粘贴歌词文本': '歌詞テキストを貼り付け', '粘贴文本处理方式': '貼り付けテキストの処理方法', '处理方式': '処理方法', '拼音文本': 'ピンインテキスト', '汉字转拼音': '漢字をピンインに変換', '按全部音符对齐（包含空歌词位和延长位）': 'すべての音符に合わせる（空欄と延長を含む）', '应用替换': '置換を適用', '撤销上次替换': '直前の置換を元に戻す', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': '漢字からピンインへの変換では英語を使えません。ピンインテキストに切り替えてください。', '请粘贴中文汉字；英文文本不会转换。': '中国語の漢字を貼り付けてください。英語は変換されません。', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '置換対象 {targets} 音符 · 貼り付け {count} 語 · 数が一致', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '置換対象 {targets} 音符 · 変換後 {count} 語 · 数が一致', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '置換対象 {targets} 音符 · 貼り付け {count} 語 · 差 {difference}', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '置換対象 {targets} 音符 · 変換後 {count} 語 · 差 {difference}', '小节 {measure} · {beat}{fraction} 拍': '{measure} 小節 · {beat}{fraction} 拍', '第 {index} 个音符歌词': '{index} 番目の音符の歌詞', '清除第 {index} 个音符歌词': '{index} 番目の音符の歌詞を消去', '还原第 {index} 个音符歌词': '{index} 番目の音符の歌詞を戻す', '时值 {duration}': '音価 {duration}', '（空）': '（空）', '（无对应音符）': '（対応する音符なし）', '（缺少）': '（不足）', '仅预览前 {count} 项；总计 {total} 项。': '先頭 {count} 件をプレビュー中（合計 {total} 件）。', '清除': '消去', '还原': '戻す', '需要编辑容器和已解析的工程。': '編集領域と解析済みプロジェクトが必要です。'
  },
  ko: {
    '声谱首页': '보컬 악보 홈', '文件仅在本机处理': '파일은 이 기기에서 처리됩니다', '切换深色主题': '다크 테마로 전환', '切换浅色主题': '라이트 테마로 전환', '深色': '다크', '浅色': '라이트', '界面语言': '인터페이스 언어', '转换设置': '변환 설정', 'SVP 人声谱': 'SVP 보컬 악보', '导入工程，生成五线谱与简谱。': '프로젝트를 가져와 오선보와 숫자 악보를 만듭니다.', '选择或拖入 SVP': 'SVP 파일을 선택하거나 끌어 놓으세요', '支持同时导入多个 .svp 文件': '.svp 파일을 여러 개 한 번에 가져올 수 있습니다', '工程文件': '프로젝트 파일', '人声声部': '보컬 파트', '全选': '모두 선택', '谱面设置': '악보 설정', '乐谱标题': '악보 제목', '节奏网格': '리듬 그리드', '八分音符': '8분음표', '十六分音符': '16분음표', '三十二分音符': '32분음표', '移调': '조옮김', '降低半音': '반음 낮추기', '升高半音': '반음 높이기', '半音': '반음', '目标音区': '목표 음역', '较低 · C3–C5': '낮음 · C3–C5', '中间 · G3–G5': '중간 · G3–G5', '较高 · C4–C6': '높음 · C4–C6', '自动移调': '자동 조옮김', '调号只改变记谱方式；移调会改变音高。': '조표는 표기만 바꾸고 조옮김은 음높이를 바꿉니다.', '节奏网格会整理音符的起止位置。': '리듬 그리드는 음표의 시작과 끝을 정리합니다.', '字体与页面': '글꼴과 페이지', '谱面文字字体': '악보 글꼴', '宋体 / 衬线': '명조 / 세리프', '黑体 / 无衬线': '고딕 / 산세리프', '楷体': '해서체', '等宽': '고정폭', '歌词字号': '가사 크기', '标题字号': '제목 크기', '每页页眉': '페이지 머리글', '可留空': '선택 사항', '署名': '작성자 표시', '首页标题下方': '첫 페이지 제목 아래', '页眉 / 署名字号': '머리글 / 작성자 크기', '页码': '페이지 번호', '小节号': '마디 번호', '文字字体使用本机已安装字体；预览、打印和 SVG 同步。音乐符号保持标准制谱字体。': '텍스트에는 이 기기에 설치된 글꼴을 사용하며 미리보기, 인쇄, SVG에 동일하게 적용됩니다. 음악 기호는 표준 기보 글꼴을 유지합니다.', '声部整理': '파트 정리', '合并分散独唱': '분리된 독창 구간 합치기', '不同声线中互不重叠的独唱片段，合并到上方；同时发声的音符保留分谱。': '겹치지 않는 독창 구간은 위 파트로 합치고, 동시에 울리는 음표는 별도 파트로 유지합니다.', '查看整理明细': '정리 내역 보기', '本地转换 · 无需上传': '로컬 변환 · 업로드 불필요', '导入 SVP 开始制谱': 'SVP를 가져와 악보 만들기', '人声总谱': '보컬 총보', '未导入工程': '가져온 프로젝트 없음', '准备就绪': '준비 완료', '五线谱': '오선보', '简谱': '숫자 악보', '打印 / PDF': '인쇄 / PDF', '导出 MusicXML': 'MusicXML 내보내기', '记谱方式': '기보 방식', '导出当前谱面 SVG ↗': '현재 악보를 SVG로 내보내기 ↗', '乐段与和声分析': '악구 및 화성 분석', '和弦是根据所选音轨推测的候选；匹配度不是正确率。重复段保留完整小节与歌词。': '코드는 선택한 파트에서 추정한 후보이며 일치도는 정확도가 아닙니다. 반복 구간은 마디와 가사를 그대로 유지합니다.', '重复乐段': '반복 악구', '和弦候选': '코드 후보', '按小节': '마디별', '歌词与声部文字': '가사와 파트 이름', '可修改或清空': '수정 또는 지우기', '单独的 - 表示延长前一个字。清空文字会保留音符；修改会写入导出的曲谱。': '단독 `-`는 이전 음절을 늘립니다. 텍스트를 지워도 음표는 유지되며 수정 내용은 내보낸 악보에 반영됩니다.', '音高微调': '음높이 미세 조정', '按音符音分和音高曲线中段的代表偏移修正半音，避免跟随短暂颤音。滑音、颤音参数单独列出；实际合成音高需要音频确认。': '음표의 센트 값과 피치 곡선 중간의 대표값으로 반음을 조정해 짧은 비브라토를 따라가지 않게 합니다. 포르타멘토와 비브라토 값은 따로 표시합니다. 실제 합성 음높이는 오디오로 확인해야 합니다.', '正在排版乐谱…': '악보 조판 중…', '乐谱预览': '악보 미리보기', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': '음높이, 가사, 박자표, 템포를 유지하고 마디를 넘는 음표는 자동으로 타이 처리합니다.', 'SVG 乐谱预览': 'SVG 악보 미리보기', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'JavaScript를 활성화하면 프로젝트를 이 기기에서 분석하고 악보를 만들 수 있습니다.',
    '声部': '파트', '声部 {count}': '파트 {count}', '未命名声部': '이름 없는 파트', 'SVP {version} · {count} 个声部': 'SVP {version} · 파트 {count}개', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': '{measure}마디 · {beat}박', '小节 {measure} · {beat} + {fraction} 拍': '{measure}마디 · {beat} + {fraction}박', '位置 {beats} 拍': '위치 {beats}박', '{count} 音符': '음표 {count}개', '音域 {low}–{high} · {transpose} 半音。{message}': '음역 {low}–{high} · {transpose}반음. {message}', '人声五线谱': '보컬 오선보', '人声简谱': '보컬 숫자 악보', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output}파트, 음표 {count}개를 위 파트로 이동', '{from} → {to}：{count} 个音符': '{from} → {to}: 음표 {count}개', '存在重叠发声，可能为和声或叠唱': '음이 겹칩니다. 화성 또는 더블링일 수 있습니다', '乐谱排版组件未能加载，请刷新页面后重试。': '악보 조판 구성 요소를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.', '{parts} 声部 · {notes} 音符': '파트 {parts}개 · 음표 {notes}개', '{count} 小节': '마디 {count}개', '五线谱 · OpenSheetMusicDisplay': '오선보 · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': '숫자 악보 · 확대 가능한 SVG', '请选择 .svp 工程文件。': '.svp 프로젝트 파일을 선택하세요.', '文件超过 25 MB，请缩小工程后再导入。': '파일이 25MB를 초과합니다. 프로젝트 크기를 줄인 뒤 가져오세요.', '工程中没有可转换的人声音符。': '변환할 보컬 음표가 없습니다.', '人声谱': '보컬 악보', '调性推测：{key}，可手动修改。': '추정 조성: {key}. 직접 변경할 수 있습니다.', '音高信息不足以确定调性，请手动选择调号。': '조성을 추정하기에 음높이 정보가 부족합니다. 조표를 직접 선택하세요.', '请选择含音符的人声声部。': '음표가 있는 보컬 파트를 선택하세요.', '调性推测 {before} → {after}。': '추정 조성 {before} → {after}.', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}.', '仍有 {count} 个音符超出目标音区。': '음표 {count}개가 목표 음역을 벗어납니다.', '音符均在目标音区内。': '모든 음표가 목표 음역 안에 있습니다.', '{repeats} 组重复 · {chords} 处和弦候选': '반복 {repeats}개 · 코드 후보 {chords}개', '{label} · {length} 小节 × {count}': '{label} · {length}마디 × {count}', '旋律与节奏相同，歌词有差异': '선율과 리듬은 같고 가사는 다릅니다', '旋律、节奏与歌词相同': '선율, 리듬, 가사가 같습니다', '未检测到至少两个小节的完全重复乐段。': '두 마디 이상 완전히 반복되는 악구가 없습니다.', '{measure} 小节 · {beat} 拍': '{measure}마디 · {beat}박', '{label}的推测和弦': '{label}의 추정 코드', '{symbol} · 匹配 {percent}%': '{symbol} · 일치 {percent}%', '不标注': '표시 안 함', '同时发声': '동시 발음', '音符汇总': '음표 집계', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': '신뢰할 만한 코드 후보를 만들 음높이 정보가 부족합니다. 독창 선율만으로 화성을 하나로 정할 수 없습니다.', '{adjusted} 个音符修正 · {detuned} 个音分微调': '음표 {adjusted}개 조정 · detune 음표 {detuned}개', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': '프로젝트: 피치 곡선 제어점 {points}개, 기타 피치 곡선 {curves}개. 명시적 표현값이 있는 음표 {explicit}개, 상속값이 있는 음표 {inherited}개.', '代表偏移达到 {threshold} 音分时，按最近半音调整。100 音分 = 1 半音；剩余音分在下表显示，谱面使用半音音阶。': '대표 편차가 {threshold}센트 이상이면 가장 가까운 반음으로 조정합니다. 100센트 = 1반음입니다. 남은 센트는 아래에 표시하며 악보는 반음계 음정을 사용합니다.', '自动半音修正已关闭，谱面使用原始音符加整体移调。': '자동 반음 보정이 꺼져 있습니다. 악보에는 원래 음표와 전체 조옮김을 사용합니다.', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': '음표 {count}개의 동적 곡선을 중간 대표값으로 단순화합니다. 비선형 곡선은 근사 샘플링을 사용합니다.', '来源声部 / 音符': '원본 파트 / 음표', '修正前': '수정 전', '修正后': '수정 후', '代表偏移': '대표 편차', '剩余音分': '잔여 센트', '{name} / {index}': '{name} / {index}', '显式': '명시', '继承': '상속', '声线': '음성', '查看滑音与颤音参数范围': '포르타멘토 및 비브라토 값 범위 보기', '{name}：{low}–{high}（{count} 个音符）': '{name}: {low}–{high} (음표 {count}개)', '文件和设置保存在当前浏览器。': '파일과 설정은 현재 브라우저에 저장됩니다.', '本机浏览器数据被清除后无法恢复。': '이 브라우저 데이터를 지우면 저장 내용을 복구할 수 없습니다.', '清除浏览器数据会删除已存内容。': '브라우저 데이터를 지우면 저장된 내용이 삭제됩니다.', '正在保存…': '저장 중…', '已保存在此浏览器': '이 브라우저에 저장됨', '保存失败': '저장 실패', '移除文件': '파일 제거', '已移除': '제거됨', '正在恢复文件…': '파일 복원 중…',
    '歌词与声部名称': '가사와 파트 이름', '清空本声部歌词': '이 파트 가사 지우기', '还原清空前内容': '지우기 전 가사 복원', '修改会自动应用': '수정 사항이 자동 적용됩니다', '已修改': '수정됨', '选择声部': '파트 선택', '声部名称': '파트 이름', '音符歌词': '음표 가사', '粘贴歌词文本': '가사 텍스트 붙여넣기', '粘贴文本处理方式': '붙여넣은 텍스트 처리 방식', '处理方式': '처리 방식', '拼音文本': '병음 텍스트', '汉字转拼音': '한자를 병음으로 변환', '按全部音符对齐（包含空歌词位和延长位）': '모든 음표에 맞춤(빈 가사 칸과 연장 칸 포함)', '应用替换': '바꾸기 적용', '撤销上次替换': '마지막 바꾸기 실행 취소', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': '한자-병음 변환에서는 영어를 사용할 수 없습니다. 병음 텍스트 모드로 전환하세요.', '请粘贴中文汉字；英文文本不会转换。': '중국어 한자를 붙여넣으세요. 영어 텍스트는 변환되지 않습니다.', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '바꿀 음표 {targets}개 · 붙여넣은 단어 {count}개 · 개수 일치', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '바꿀 음표 {targets}개 · 변환된 단어 {count}개 · 개수 일치', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '바꿀 음표 {targets}개 · 붙여넣은 단어 {count}개 · 차이 {difference}개', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '바꿀 음표 {targets}개 · 변환된 단어 {count}개 · 차이 {difference}개', '小节 {measure} · {beat}{fraction} 拍': '{measure}마디 · {beat}{fraction}박', '第 {index} 个音符歌词': '{index}번째 음표 가사', '清除第 {index} 个音符歌词': '{index}번째 음표 가사 지우기', '还原第 {index} 个音符歌词': '{index}번째 음표 가사 복원', '时值 {duration}': '길이 {duration}', '（空）': '(비어 있음)', '（无对应音符）': '(해당 음표 없음)', '（缺少）': '(누락)', '仅预览前 {count} 项；总计 {total} 项。': '{total}개 중 처음 {count}개 미리보기.', '清除': '지우기', '还原': '복원', '需要编辑容器和已解析的工程。': '편집 영역과 파싱된 프로젝트가 필요합니다.'
  }
};

const aliases = {
  'zh-CN': {
    'lyricEditor.title': '歌词与声部名称', 'lyricEditor.voice': '声部', 'lyricEditor.voiceName': '声部名称', 'lyricEditor.clearAll': '清空本声部歌词', 'lyricEditor.restoreAll': '还原清空前内容', 'lyricEditor.pasteText': '粘贴歌词文本', 'lyricEditor.pasteMode': '处理方式', 'lyricEditor.pinyinMode': '拼音文本', 'lyricEditor.hanziMode': '汉字转拼音', 'lyricEditor.alignAll': '按全部音符对齐（包含空歌词位和延长位）', 'lyricEditor.apply': '应用替换', 'lyricEditor.undoBatch': '撤销上次替换', 'lyricEditor.replacementCount': '待替换 {targets} 个音符 · 粘贴 {tokens} 个词', 'lyricEditor.mismatchCount': '数量差 {difference} 个', 'lyricEditor.countExact': '数量匹配', 'lyricEditor.countOver': '多出 {difference} 个词', 'lyricEditor.countUnder': '还差 {difference} 个词', 'lyricEditor.invalidHanzi': '请粘贴中文汉字；英文文本不会转换。', 'lyricEditor.rejectEnglish': '汉字转拼音模式不接受英文；请切换到拼音文本模式。', 'lyricEditor.extraLyric': '（多余歌词）', 'lyricEditor.missingLyric': '（缺少）', 'lyricEditor.previewMore': '仅预览前 {count} 项；总计 {total} 项。', 'lyricEditor.noteLyric': '第 {index} 个音符歌词', 'lyricEditor.clearNote': '清除第 {index} 个音符歌词', 'lyricEditor.restoreNote': '还原第 {index} 个音符歌词', 'lyricEditor.position': "小节 {bar} · {beat} 拍", 'lyricEditor.duration': '时值 {duration}', 'lyricEditor.empty': '（空）', 'lyricEditor.noVoice': '（无对应音符）',
    "声谱": "声谱",
    "调号": "调号",
    "大调": "大调",
    "小调": "小调",
    "自动修正音阶": "自动修正音阶",
    "偏移阈值": "偏移阈值",
    "当前所选声部没有触发半音修正。": "当前所选声部没有触发半音修正。",
    "{parts} 声部 · {count} 音符": "{parts} 声部 · {count} 音符",
    "{count} 音分": "{count} 音分",
    "音域 {range} · {shift} 半音。": "音域 {range} · {shift} 半音。",
    "{length} 小节 × {count}": "{length} 小节 × {count}",
    "{name}：存在重叠发声，可能为和声或叠唱": "{name}：存在重叠发声，可能为和声或叠唱",
    "匹配 {percent}%": "匹配 {percent}%",
    "推测和弦": "推测和弦",
    "工程文件列表": "工程文件列表",
    "无升降号": "无升降号",
    "移除文件 {name}": "移除文件 {name}",
    "文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。": "文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。",
    "选择或拖入文件，生成五线谱与简谱。": "选择或拖入文件，生成五线谱与简谱。",
    "请至少选择一个人声声部。": "请至少选择一个人声声部。",
    "文件不是有效的 SVP JSON，请检查文件是否完整。": "文件不是有效的 SVP JSON，请检查文件是否完整。",
    "这个 JSON 文件不是 Synthesizer V 工程。": "这个 JSON 文件不是 Synthesizer V 工程。",
    "调号为手动设置。": "调号为手动设置。",
    "调号已随整体移调更新。": "调号已随整体移调更新。",
    "保存失败；请保留原文件并检查浏览器存储空间。": "保存失败；请保留原文件并检查浏览器存储空间。",
    "移除失败，请重试。": "移除失败，请重试。",
    "无法读取浏览器存储；请检查浏览器的数据权限。": "无法读取浏览器存储；请检查浏览器的数据权限。",
    "（异词）": "（异词）",
    "和弦为自动推测（?）": "和弦为自动推测（?）",
    "lyricEditor.notes": "音符歌词",
    "by 署名": "署名",
    "标记重复乐段": "标记重复乐段",
    "谱面显示推测和弦": "谱面显示推测和弦",
    "PDF 预览": "PDF 预览",
    "上一页": "上一页",
    "下一页": "下一页",
    "适合页面": "适合页面",
    "正在加载 PDF…": "正在加载 PDF…",
    "第 {page} 页，共 {total} 页": "第 {page} 页，共 {total} 页",
    "PDF 渲染失败": "PDF 渲染失败",
    "下载 PDF": "下载 PDF",
    "方向": "方向",
    "横向": "横向",
    "纵向": "纵向",
    "纸张": "纸张",
    "汉字替换拼音": "汉字替换拼音",
    "PDF 缩放": "PDF 缩放",
    "适合页宽": "适合页宽",
    "svp.warning.missingGroup": "{track}：未找到音符组 {group}。",
    "svp.warning.invalidNote": "{track}：已跳过起始位置、时值或音高无效的音符。",
    "svp.warning.invalidDetune": "{track}：已忽略非有限的音符微调值。",
    "svp.warning.pitchControls": "{track}：音高控制曲线无法写入 MusicXML。",
    "svp.warning.linearCurve": "{track}：音高曲线使用线性采样近似来调整音符。",
    "svp.warning.representativeCurve": "{track}：音高曲线形状简化为每个音符的代表值。",
    "svp.warning.residual": "{track}：剩余 {cents} 音分作为元数据保留，未写入乐谱。",
    "svp.warning.quantized": "{track}：有 {count} 个音符的起止位置经节奏网格调整。",
    "svp.warning.overlap": "{track}：重叠音符以 {count} 个声部呈现。",
    "svp.warning.midiRange": "{track}：音高 {pitch} 超出 MIDI 0–127 范围，或不是整数半音。",
    "svp.warning.multivoiceJianpu": "{track}：此简谱渲染器不支持一个分谱中的多个声部。",
    "svp.error.invalidXml": "MusicXML 文件无效或无法读取。",
    "svp.error.noParts": "MusicXML 文件不包含任何声部。",
    "svp.error.grid": "节奏网格必须为 4、8、16 或 32。",
    "svp.error.pitchAdjustment": "音高修正需要启用状态及 0 到 1200 音分之间的阈值。",
    "svp.error.transpose": "移调或调号无效。",
    "svp.error.noTrack": "请至少选择一个人声声部。",
    "svp.error.noNotes": "所选声部不包含人声音符。",
    "svp.error.unsupportedDuration": "无法用所选节奏网格表示时值 {duration}。",
    "svp.error.unsupportedRest": "无法用所选节奏网格表示休止时值 {duration}。",
    "svp.error.timeSignature": "不支持此拍号长度。",
    "svp.error.measureLimit": "乐谱超过支持的小节数上限。"
  },
  en: {
    'lyricEditor.title': 'Lyrics and part names', 'lyricEditor.voice': 'Part', 'lyricEditor.voiceName': 'Part name', 'lyricEditor.clearAll': 'Clear lyrics in this part', 'lyricEditor.restoreAll': 'Restore lyrics before clearing', 'lyricEditor.pasteText': 'Paste lyrics', 'lyricEditor.pasteMode': 'Processing mode', 'lyricEditor.pinyinMode': 'Pinyin text', 'lyricEditor.hanziMode': 'Convert Hanzi to Pinyin', 'lyricEditor.alignAll': 'Align to all notes (including empty lyric slots and extensions)', 'lyricEditor.apply': 'Apply replacements', 'lyricEditor.undoBatch': 'Undo last replacement', 'lyricEditor.replacementCount': '{targets} notes to replace · {tokens} pasted words', 'lyricEditor.mismatchCount': 'Off by {difference}', 'lyricEditor.countExact': 'Count matches', 'lyricEditor.countOver': '{difference} extra words', 'lyricEditor.countUnder': '{difference} words missing', 'lyricEditor.invalidHanzi': 'Paste Chinese characters; English text will not be converted.', 'lyricEditor.rejectEnglish': 'English is not accepted in Hanzi-to-Pinyin mode. Switch to Pinyin text mode.', 'lyricEditor.extraLyric': '(extra lyric)', 'lyricEditor.missingLyric': '(missing)', 'lyricEditor.previewMore': 'Showing the first {count} of {total} items.', 'lyricEditor.noteLyric': 'Lyrics for note {index}', 'lyricEditor.clearNote': 'Clear lyrics for note {index}', 'lyricEditor.restoreNote': 'Restore lyrics for note {index}', 'lyricEditor.position': "Measure {bar} · beat {beat}", 'lyricEditor.duration': 'Duration {duration}', 'lyricEditor.empty': '(empty)', 'lyricEditor.noVoice': '(no matching note)',
    "声谱": "Vocal Score",
    "调号": "Key signature",
    "大调": "major",
    "小调": "minor",
    "自动修正音阶": "Automatic semitone correction",
    "偏移阈值": "Offset threshold",
    "当前所选声部没有触发半音修正。": "No notes in the selected parts require semitone correction.",
    "{parts} 声部 · {count} 音符": "{parts} parts · {count} notes",
    "{count} 音分": "{count} cents",
    "音域 {range} · {shift} 半音。": "Range {range} · {shift} semitones.",
    "{length} 小节 × {count}": "{length} measures × {count}",
    "{name}：存在重叠发声，可能为和声或叠唱": "{name}: overlapping notes may indicate harmony or doubling",
    "匹配 {percent}%": "{percent}% match",
    "推测和弦": "Inferred chord",
    "工程文件列表": "Project file list",
    "无升降号": "No sharps or flats",
    "移除文件 {name}": "Remove file {name}",
    "文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。": "Files and settings are saved in this browser. Clearing browser data deletes saved content.",
    "选择或拖入文件，生成五线谱与简谱。": "Choose or drop a file to create staff and numbered notation.",
    "请至少选择一个人声声部。": "Select at least one vocal part.",
    "文件不是有效的 SVP JSON，请检查文件是否完整。": "This is not valid SVP JSON. Check that the file is complete.",
    "这个 JSON 文件不是 Synthesizer V 工程。": "This JSON file is not a Synthesizer V project.",
    "调号为手动设置。": "Key signature set manually.",
    "调号已随整体移调更新。": "Key signature updated with the transposition.",
    "保存失败；请保留原文件并检查浏览器存储空间。": "Save failed. Keep the original file and check available browser storage.",
    "移除失败，请重试。": "Could not remove the file. Try again.",
    "无法读取浏览器存储；请检查浏览器的数据权限。": "Could not read browser storage. Check the browser data permissions.",
    "（异词）": "(different lyrics)",
    "和弦为自动推测（?）": "Chord inferred automatically (?)",
    "lyricEditor.notes": "Note lyrics",
    "by 署名": "Byline",
    "标记重复乐段": "Mark repeated phrases",
    "谱面显示推测和弦": "Show inferred chords on the score",
    "PDF 预览": "PDF preview",
    "上一页": "Previous page",
    "下一页": "Next page",
    "适合页面": "Fit page",
    "正在加载 PDF…": "Loading PDF…",
    "第 {page} 页，共 {total} 页": "Page {page} of {total}",
    "PDF 渲染失败": "Could not render PDF",
    "下载 PDF": "Download PDF",
    "方向": "Orientation",
    "横向": "Landscape",
    "纵向": "Portrait",
    "纸张": "Paper size",
    "汉字替换拼音": "Replace Pinyin with Chinese characters",
    "PDF 缩放": "PDF zoom",
    "适合页宽": "Fit width",
    "svp.warning.missingGroup": "{track}: note group {group} was not found.",
    "svp.warning.invalidNote": "{track}: skipped a note with invalid onset, duration, or pitch.",
    "svp.warning.invalidDetune": "{track}: ignored a non-finite note detune value.",
    "svp.warning.pitchControls": "{track}: pitch control curves cannot be represented in MusicXML.",
    "svp.warning.linearCurve": "{track}: a linear sampling approximation was used to adjust notes from the pitch curve.",
    "svp.warning.representativeCurve": "{track}: pitch curve shape was reduced to one representative value per note.",
    "svp.warning.residual": "{track}: the remaining {cents}-cent tuning deviation is preserved as metadata, not engraved.",
    "svp.warning.quantized": "{count} note(s) in {track} were shifted to the rhythm grid.",
    "svp.warning.overlap": "{track}: overlapping notes are rendered as {count} voices.",
    "svp.warning.midiRange": "{track}: pitch {pitch} is outside MIDI range 0–127 or is not an integer semitone.",
    "svp.warning.multivoiceJianpu": "{track}: this numbered-score renderer does not support multiple voices in one part.",
    "svp.error.invalidXml": "The MusicXML document is invalid or unreadable.",
    "svp.error.noParts": "The MusicXML document contains no parts.",
    "svp.error.grid": "Grid must be 4, 8, 16, or 32.",
    "svp.error.pitchAdjustment": "Pitch adjustment requires an enabled flag and a threshold between 0 and 1200 cents.",
    "svp.error.transpose": "Invalid transposition or key signature.",
    "svp.error.noTrack": "Select at least one vocal track.",
    "svp.error.noNotes": "Selected tracks contain no vocal notes.",
    "svp.error.unsupportedDuration": "Duration {duration} cannot be represented at the selected grid.",
    "svp.error.unsupportedRest": "Rest duration {duration} cannot be represented at the selected grid.",
    "svp.error.timeSignature": "Unsupported time signature length.",
    "svp.error.measureLimit": "Score exceeds the supported measure limit."
  },
  ja: {
    'lyricEditor.title': '歌詞とパート名', 'lyricEditor.voice': 'パート', 'lyricEditor.voiceName': 'パート名', 'lyricEditor.clearAll': 'このパートの歌詞を消去', 'lyricEditor.restoreAll': '消去前の歌詞に戻す', 'lyricEditor.pasteText': '歌詞を貼り付け', 'lyricEditor.pasteMode': '処理方法', 'lyricEditor.pinyinMode': 'ピンインテキスト', 'lyricEditor.hanziMode': '漢字をピンインに変換', 'lyricEditor.alignAll': 'すべての音符に合わせる（空の歌詞欄と延長を含む）', 'lyricEditor.apply': '置換を適用', 'lyricEditor.undoBatch': '前回の置換を元に戻す', 'lyricEditor.replacementCount': '置換対象 {targets} 音符 · 貼り付けた単語 {tokens} 個', 'lyricEditor.mismatchCount': '{difference} 個の差', 'lyricEditor.countExact': '個数一致', 'lyricEditor.countOver': '単語が {difference} 個多い', 'lyricEditor.countUnder': '単語が {difference} 個足りない', 'lyricEditor.invalidHanzi': '中国語の漢字を貼り付けてください。英語は変換されません。', 'lyricEditor.rejectEnglish': '漢字からピンインへの変換では英語を使えません。ピンインテキストに切り替えてください。', 'lyricEditor.extraLyric': '（余分な歌詞）', 'lyricEditor.missingLyric': '（不足）', 'lyricEditor.previewMore': '全 {total} 項目中、最初の {count} 項目を表示しています。', 'lyricEditor.noteLyric': '{index} 番目の音符の歌詞', 'lyricEditor.clearNote': '{index} 番目の音符の歌詞を消去', 'lyricEditor.restoreNote': '{index} 番目の音符の歌詞を復元', 'lyricEditor.position': "{bar} 小節 · {beat} 拍", 'lyricEditor.duration': '長さ {duration}', 'lyricEditor.empty': '（空）', 'lyricEditor.noVoice': '（該当する音符なし）',
    "声谱": "ボーカル譜",
    "调号": "調号",
    "大调": "長調",
    "小调": "短調",
    "自动修正音阶": "自動半音補正",
    "偏移阈值": "偏移しきい値",
    "当前所选声部没有触发半音修正。": "選択中のパートに半音補正が必要な音符はありません。",
    "{parts} 声部 · {count} 音符": "{parts} パート · {count} 音符",
    "{count} 音分": "{count} セント",
    "音域 {range} · {shift} 半音。": "音域 {range} · {shift} 半音。",
    "{length} 小节 × {count}": "{length} 小節 × {count}",
    "{name}：存在重叠发声，可能为和声或叠唱": "{name}：音が重なっています。ハーモニーまたはダブリングの可能性があります",
    "匹配 {percent}%": "一致度 {percent}%",
    "推测和弦": "推定コード",
    "工程文件列表": "プロジェクトファイル一覧",
    "无升降号": "シャープ・フラットなし",
    "移除文件 {name}": "ファイル {name} を削除",
    "文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。": "ファイルと設定はこのブラウザーに保存されます。ブラウザーのデータを消去すると保存内容が削除されます。",
    "选择或拖入文件，生成五线谱与简谱。": "ファイルを選択またはドロップして、五線譜と数字譜を作成します。",
    "请至少选择一个人声声部。": "ボーカルパートを1つ以上選択してください。",
    "文件不是有效的 SVP JSON，请检查文件是否完整。": "有効な SVP JSON ではありません。ファイルが完全か確認してください。",
    "这个 JSON 文件不是 Synthesizer V 工程。": "この JSON ファイルは Synthesizer V のプロジェクトではありません。",
    "调号为手动设置。": "調号を手動で設定しました。",
    "调号已随整体移调更新。": "全体移調に合わせて調号を更新しました。",
    "保存失败；请保留原文件并检查浏览器存储空间。": "保存に失敗しました。元のファイルを保管し、ブラウザーの空き容量を確認してください。",
    "移除失败，请重试。": "ファイルを削除できませんでした。もう一度お試しください。",
    "无法读取浏览器存储；请检查浏览器的数据权限。": "ブラウザーの保存領域を読み込めません。ブラウザーのデータ権限を確認してください。",
    "（异词）": "（歌詞違い）",
    "和弦为自动推测（?）": "コードは自動推定（?）",
    "lyricEditor.notes": "音符の歌詞",
    "by 署名": "署名",
    "标记重复乐段": "反復フレーズを表示",
    "谱面显示推测和弦": "推定コードを譜面に表示",
    "PDF 预览": "PDF プレビュー",
    "上一页": "前のページ",
    "下一页": "次のページ",
    "适合页面": "ページに合わせる",
    "正在加载 PDF…": "PDF を読み込み中…",
    "第 {page} 页，共 {total} 页": "{total} ページ中 {page} ページ目",
    "PDF 渲染失败": "PDF を表示できませんでした",
    "下载 PDF": "PDF をダウンロード",
    "方向": "向き",
    "横向": "横向き",
    "纵向": "縦向き",
    "纸张": "用紙サイズ",
    "汉字替换拼音": "ピンインを漢字に置き換える",
    "PDF 缩放": "PDF の拡大率",
    "适合页宽": "幅に合わせる",
    "svp.warning.missingGroup": "{track}：音符グループ {group} が見つかりません。",
    "svp.warning.invalidNote": "{track}：開始位置、長さ、音高が無効な音符を除外しました。",
    "svp.warning.invalidDetune": "{track}：有限値ではない音符の微調整を無視しました。",
    "svp.warning.pitchControls": "{track}：ピッチ制御カーブは MusicXML で表現できません。",
    "svp.warning.linearCurve": "{track}：ピッチカーブから音符を調整する際、線形サンプリング近似を使いました。",
    "svp.warning.representativeCurve": "{track}：ピッチカーブの形状を音符ごとの代表値に簡略化しました。",
    "svp.warning.residual": "{track}：残り {cents} セントの音程差はメタデータとして保持し、楽譜には記譜しません。",
    "svp.warning.quantized": "{track}：{count} 個の音符の開始位置または終了位置をリズムグリッドに合わせました。",
    "svp.warning.overlap": "{track}：重なり合う音符を {count} 声部として表示します。",
    "svp.warning.midiRange": "{track}：音高 {pitch} は MIDI の範囲 0～127 外、または整数半音ではありません。",
    "svp.warning.multivoiceJianpu": "{track}：この数字譜レンダラーは1パート内の複数声部に対応していません。",
    "svp.error.invalidXml": "MusicXML ファイルが無効か、読み取れません。",
    "svp.error.noParts": "MusicXML ファイルにパートがありません。",
    "svp.error.grid": "リズムグリッドは 4、8、16、32 のいずれかにしてください。",
    "svp.error.pitchAdjustment": "音高調整には有効状態と 0～1200 セントのしきい値が必要です。",
    "svp.error.transpose": "移調または調号が無効です。",
    "svp.error.noTrack": "ボーカルパートを1つ以上選択してください。",
    "svp.error.noNotes": "選択したパートにボーカル音符がありません。",
    "svp.error.unsupportedDuration": "音価 {duration} は選択したリズムグリッドで表現できません。",
    "svp.error.unsupportedRest": "休符の長さ {duration} は選択したリズムグリッドで表現できません。",
    "svp.error.timeSignature": "この拍子の長さには対応していません。",
    "svp.error.measureLimit": "楽譜が対応可能な小節数の上限を超えています。"
  },
  ko: {
    'lyricEditor.title': '가사와 파트 이름', 'lyricEditor.voice': '파트', 'lyricEditor.voiceName': '파트 이름', 'lyricEditor.clearAll': '이 파트 가사 지우기', 'lyricEditor.restoreAll': '지우기 전 가사 복원', 'lyricEditor.pasteText': '가사 붙여넣기', 'lyricEditor.pasteMode': '처리 방식', 'lyricEditor.pinyinMode': '병음 텍스트', 'lyricEditor.hanziMode': '한자를 병음으로 변환', 'lyricEditor.alignAll': '모든 음표에 맞춤(빈 가사 칸과 연장 포함)', 'lyricEditor.apply': '바꾸기 적용', 'lyricEditor.undoBatch': '마지막 바꾸기 실행 취소', 'lyricEditor.replacementCount': '바꿀 음표 {targets}개 · 붙여넣은 단어 {tokens}개', 'lyricEditor.mismatchCount': '{difference}개 차이', 'lyricEditor.countExact': '개수 일치', 'lyricEditor.countOver': '단어 {difference}개 초과', 'lyricEditor.countUnder': '단어 {difference}개 부족', 'lyricEditor.invalidHanzi': '중국어 한자를 붙여넣으세요. 영어는 변환되지 않습니다.', 'lyricEditor.rejectEnglish': '한자-병음 변환에서는 영어를 사용할 수 없습니다. 병음 텍스트 모드로 전환하세요.', 'lyricEditor.extraLyric': '(남는 가사)', 'lyricEditor.missingLyric': '(누락)', 'lyricEditor.previewMore': '전체 {total}개 중 처음 {count}개를 미리 봅니다.', 'lyricEditor.noteLyric': '{index}번째 음표 가사', 'lyricEditor.clearNote': '{index}번째 음표 가사 지우기', 'lyricEditor.restoreNote': '{index}번째 음표 가사 복원', 'lyricEditor.position': "{bar}마디 · {beat}박", 'lyricEditor.duration': '길이 {duration}', 'lyricEditor.empty': '(비어 있음)', 'lyricEditor.noVoice': '(해당 음표 없음)',
    "声谱": "보컬 악보",
    "调号": "조표",
    "大调": "장조",
    "小调": "단조",
    "自动修正音阶": "자동 반음 보정",
    "偏移阈值": "편차 임계값",
    "当前所选声部没有触发半音修正。": "선택한 파트에 반음 보정이 필요한 음표가 없습니다.",
    "{parts} 声部 · {count} 音符": "파트 {parts}개 · 음표 {count}개",
    "{count} 音分": "{count}센트",
    "音域 {range} · {shift} 半音。": "음역 {range} · {shift}반음.",
    "{length} 小节 × {count}": "{length}마디 × {count}",
    "{name}：存在重叠发声，可能为和声或叠唱": "{name}: 음이 겹칩니다. 화성 또는 더블링일 수 있습니다",
    "匹配 {percent}%": "{percent}% 일치",
    "推测和弦": "추정 코드",
    "工程文件列表": "프로젝트 파일 목록",
    "无升降号": "올림표·내림표 없음",
    "移除文件 {name}": "{name} 파일 제거",
    "文件和设置保存在当前浏览器。清除浏览器数据会删除已存内容。": "파일과 설정은 현재 브라우저에 저장됩니다. 브라우저 데이터를 지우면 저장된 내용이 삭제됩니다.",
    "选择或拖入文件，生成五线谱与简谱。": "파일을 선택하거나 끌어 놓아 오선보와 숫자 악보를 만드세요.",
    "请至少选择一个人声声部。": "보컬 파트를 하나 이상 선택하세요.",
    "文件不是有效的 SVP JSON，请检查文件是否完整。": "올바른 SVP JSON이 아닙니다. 파일이 완전한지 확인하세요.",
    "这个 JSON 文件不是 Synthesizer V 工程。": "이 JSON 파일은 Synthesizer V 프로젝트가 아닙니다.",
    "调号为手动设置。": "조표를 직접 설정했습니다.",
    "调号已随整体移调更新。": "전체 조옮김에 맞춰 조표를 업데이트했습니다.",
    "保存失败；请保留原文件并检查浏览器存储空间。": "저장에 실패했습니다. 원본 파일을 보관하고 브라우저 저장 공간을 확인하세요.",
    "移除失败，请重试。": "파일을 제거하지 못했습니다. 다시 시도하세요.",
    "无法读取浏览器存储；请检查浏览器的数据权限。": "브라우저 저장소를 읽을 수 없습니다. 브라우저 데이터 권한을 확인하세요.",
    "（异词）": "(가사 다름)",
    "和弦为自动推测（?）": "코드는 자동 추정됨 (?)",
    "lyricEditor.notes": "음표 가사",
    "by 署名": "작성자",
    "标记重复乐段": "반복 악구 표시",
    "谱面显示推测和弦": "악보에 추정 코드 표시",
    "PDF 预览": "PDF 미리보기",
    "上一页": "이전 페이지",
    "下一页": "다음 페이지",
    "适合页面": "페이지에 맞춤",
    "正在加载 PDF…": "PDF 불러오는 중…",
    "第 {page} 页，共 {total} 页": "전체 {total}페이지 중 {page}페이지",
    "PDF 渲染失败": "PDF를 렌더링하지 못했습니다",
    "下载 PDF": "PDF 다운로드",
    "方向": "방향",
    "横向": "가로",
    "纵向": "세로",
    "纸张": "용지 크기",
    "汉字替换拼音": "병음을 한자로 바꾸기",
    "PDF 缩放": "PDF 확대/축소",
    "适合页宽": "너비에 맞춤",
    "svp.warning.missingGroup": "{track}: 음표 그룹 {group}을(를) 찾을 수 없습니다.",
    "svp.warning.invalidNote": "{track}: 시작 위치, 길이 또는 음높이가 잘못된 음표를 건너뛰었습니다.",
    "svp.warning.invalidDetune": "{track}: 유한하지 않은 음표 미세 조정을 무시했습니다.",
    "svp.warning.pitchControls": "{track}: 피치 제어 곡선은 MusicXML로 표현할 수 없습니다.",
    "svp.warning.linearCurve": "{track}: 피치 곡선으로 음표를 조정할 때 선형 샘플링 근사값을 사용했습니다.",
    "svp.warning.representativeCurve": "{track}: 피치 곡선 모양을 음표마다 대표값 하나로 단순화했습니다.",
    "svp.warning.residual": "{track}: 남은 {cents}센트 조율 편차는 메타데이터로 보존하며 악보에는 표기하지 않습니다.",
    "svp.warning.quantized": "{track}의 음표 {count}개 시작 또는 끝을 리듬 그리드에 맞췄습니다.",
    "svp.warning.overlap": "{track}: 겹치는 음표를 {count}개 성부로 표시합니다.",
    "svp.warning.midiRange": "{track}: 음높이 {pitch}가 MIDI 0–127 범위를 벗어나거나 정수 반음이 아닙니다.",
    "svp.warning.multivoiceJianpu": "{track}: 이 숫자 악보 렌더러는 한 파트 안의 여러 성부를 지원하지 않습니다.",
    "svp.error.invalidXml": "MusicXML 문서가 잘못되었거나 읽을 수 없습니다.",
    "svp.error.noParts": "MusicXML 문서에 파트가 없습니다.",
    "svp.error.grid": "리듬 그리드는 4, 8, 16 또는 32여야 합니다.",
    "svp.error.pitchAdjustment": "음높이 조정에는 활성화 상태와 0~1200센트 임계값이 필요합니다.",
    "svp.error.transpose": "조옮김 또는 조표가 올바르지 않습니다.",
    "svp.error.noTrack": "보컬 파트를 하나 이상 선택하세요.",
    "svp.error.noNotes": "선택한 파트에 보컬 음표가 없습니다.",
    "svp.error.unsupportedDuration": "선택한 리듬 그리드로 길이 {duration}을(를) 표현할 수 없습니다.",
    "svp.error.unsupportedRest": "선택한 리듬 그리드로 쉼표 길이 {duration}을(를) 표현할 수 없습니다.",
    "svp.error.timeSignature": "지원하지 않는 박자 길이입니다.",
    "svp.error.measureLimit": "악보가 지원하는 마디 수를 초과했습니다."
  }
};

const languageStorageKey = 'svp-vocal-score.language';
const locales = ['zh-CN', 'en', 'ja', 'ko'];
const normalizeLanguage = locale => {
  const value = String(locale ?? '').trim().toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('ko')) return 'ko';
  return null;
};
function detectLanguage() {
  try {
    const stored = normalizeLanguage(globalThis.localStorage?.getItem(languageStorageKey));
    if (stored) return stored;
  } catch {}
  const candidates = globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language];
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);
    if (language) return language;
  }
  return 'zh-CN';
}

const sourceKeys = new Set([...Object.values(catalog).flatMap(Object.keys), ...Object.values(aliases).flatMap(Object.keys)]);
const messageKeyBySource = new Map([...sourceKeys].map((key, index) => [key, `message${index}`]));
const messages = Object.fromEntries(locales.map(locale => {
  const translated = {...catalog[locale], ...aliases[locale]};
  return [locale, Object.fromEntries([...sourceKeys].map(source => [messageKeyBySource.get(source), translated[source] ?? source]))];
}));

export const i18n = createI18n({legacy: false, locale: detectLanguage(), fallbackLocale: 'zh-CN', messages});

export function getLanguage() { return i18n.global.locale.value; }

export function t(key, params = {}) {
  const source = String(key);
  const messageKey = messageKeyBySource.get(source);
  if (messageKey) return i18n.global.t(messageKey, params);
  return source.replace(/\{([\w]+)\}/gu, (match, name) => Object.hasOwn(params || {}, name) ? String(params[name]) : '');
}

export function setLanguage(locale) {
  const next = normalizeLanguage(locale);
  if (!next) throw new RangeError(`Unsupported language: ${locale}`);
  const changed = next !== getLanguage();
  i18n.global.locale.value = next;
  try { globalThis.localStorage?.setItem(languageStorageKey, next); } catch {}
  if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = next;
  if (changed && globalThis.window?.dispatchEvent) {
    globalThis.window.dispatchEvent(new CustomEvent('scorelanguagechange', {detail: {language: next}}));
  }
  return next;
}

if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = getLanguage();
