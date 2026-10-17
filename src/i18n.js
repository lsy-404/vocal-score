import {createI18n} from 'vue-i18n';

const catalog = {
  en: {
    '返回主菜单': 'Back to main menu', '返回 Tiny Projects 主菜单': 'Return to the Tiny Projects main menu',
    '织音机首页': 'Sound Loom home', '文件仅在本机处理': 'Files are processed on this device', '切换深色主题': 'Switch to dark theme', '切换浅色主题': 'Switch to light theme', '深色': 'Dark', '浅色': 'Light', '界面语言': 'Interface language', '转换设置': 'Conversion settings', '选择或拖入 SVP': 'Choose or drop SVP files', '工程文件': 'Project files', '人声声部': 'Vocal parts', '全选': 'Select all', '谱面设置': 'Score settings', '乐谱标题': 'Score title', '节奏网格': 'Rhythm grid', '八分音符': 'Eighth notes', '十六分音符': 'Sixteenth notes', '三十二分音符': 'Thirty-second notes', '移调': 'Transpose', '降低半音': 'Lower by one semitone', '升高半音': 'Raise by one semitone', '半音': 'semitones', '目标音区': 'Target range', '较低 · C3–C5': 'Low · C3–C5', '中间 · G3–G5': 'Mid · G3–G5', '较高 · C4–C6': 'High · C4–C6', '自动移调': 'Auto-transpose', '字体与页面': 'Fonts and page', '谱面文字字体': 'Score text font', '宋体 / 衬线': 'Serif', '黑体 / 无衬线': 'Sans serif', '楷体': 'Kai style', '等宽': 'Monospaced', '歌词字号': 'Lyric size', '标题字号': 'Title size', '每页页眉': 'Header on each page', '可留空': 'Optional', '署名': 'Byline', '首页标题下方': 'Below the title on the first page', '页眉 / 署名字号': 'Header / byline size', '页码': 'Page numbers', '小节号': 'Measure numbers', '声部整理': 'Part arrangement', '合并分散独唱': 'Merge separated solo passages', '记谱风格': 'Notation style', '风格预设': 'Style preset', '流行旋律谱': 'Pop lead sheet', '合唱谱（标准记谱）': 'Choral (standard engraving)', '简洁': 'Clean', '原样（不合并）': 'As in the project (no merging)', '自定义': 'Custom', '自动 · 逐音识别': 'Auto · judged note by note', '；识别出 {glides} 处滑音、{ornaments} 处装饰音': '; found {glides} glides and {ornaments} ornaments', '滑音与装饰音': 'Glides and ornaments', '滑音线': 'Slide line', '倚音': 'Grace notes', '并入前一音': 'Join the previous note', '保留音符': 'Keep as notes', '花腔记法': 'Melismas', '延长线': 'Extender line', '连线': 'Slur', '连线 + 延长线': 'Slur + extender', '三连音标记': 'Triplet marks', '括号与数字': 'Bracket and number', '只写数字': 'Number only', '重复时省略': 'Omit when repeated', '摇摆记法（Swing）': 'Swing notation', '{count} 拍按摇摆记法写成平直八分音符': '{count} beats written as straight eighths under Swing', '摇摆记法把 ♩♪ 三连音写成平直八分音符，并在谱首标注 Swing。': 'Swing notation writes ♩♪ triplets as straight eighths and marks Swing at the start.', '允许合并不同声库': 'Allow merging different voice banks', '织音机源代码': 'Sound Loom source code', '第三方许可': 'Third-party licenses', '自校': 'Self-check', '用本曲其他声部和前后同句的汉字补全拼音歌词': 'Fill pinyin lyrics with characters from other parts and the same phrases elsewhere in this song', '自校：用本曲补全拼音': 'Self-check: fill pinyin from this song', '在本曲中找到 {count} 处拼音可以补成汉字：其他声部同时唱 {time} 处，前后同句 {context} 处。可以逐字选择，或全部采用。': 'Found {count} pinyin lyrics this song can fill in: {time} sung by another part at the same time, {context} from the same phrase elsewhere. Choose character by character, or accept all.', '本曲中没有可以直接补全的拼音。': 'Nothing in this song can fill in its pinyin directly.', '第 {bar} 小节': 'Bar {bar}', '保留拼音': 'Keep pinyin', '全部采用（{count}）': 'Accept all ({count})', '以后再说': 'Later', '关闭': 'Close', '已补 {count} 处 · 撤销': 'Filled {count} · Undo', '{count} 处拼音可补汉字': '{count} pinyin lyrics can take characters', '逐个打开拼音歌词的候选汉字': 'Open the suggested characters for each pinyin lyric in turn', '歌曲': 'Songs', '歌曲列表': 'Song list', '已挂到 {count} 个工程': 'Attached to {count} projects', '未挂接': 'Not attached', '挂到当前工程': 'Attach to the open project', '解除挂接': 'Detach', '删除歌曲 {name}': 'Delete song {name}', '删除歌曲': 'Delete song', '点击歌曲挂到当前工程，再点一次解除挂接；一首歌曲可挂到多个工程，各自记偏移。': 'Click a song to attach it to the open project; click again to detach. One song can serve several projects, each with its own offset.', '解除挂接（歌曲仍保留，可挂到其他工程）': 'Detach (the song stays and can be attached to other projects)', '挂接已有歌曲': 'Attach a saved song', '{track} 同时唱': 'Sung by {track} at the same time', '词语“{word}”': 'Word “{word}”', '第 {bar} 小节“{snippet}”': 'Bar {bar}: “{snippet}”', '有候选汉字，点击选择': 'Characters suggested; click to choose', '候选汉字': 'Suggested characters', '更多同音字（{reading}）': 'More characters read {reading}', '同时替换其他声部同一位置的 {reading}（{count} 处）': 'Also replace {reading} sung at the same time in other parts ({count})', '本声部 {count} 处拼音按同时演唱的汉字填入': 'Fill {count} pinyin lyrics in this part from characters sung at the same time', '播放': 'Play', '暂停': 'Pause', '回到开头': 'Back to start', '播放控制': 'Playback controls', '播放进度': 'Playback position', '钢琴': 'Piano', '按谱用内置钢琴播放': 'Play the score on the built-in piano', '打开音频（推荐）': 'Open audio (recommended)', '打开合成器导出的音频，光标跟着真实人声走；文件只在本机读取。': 'Open the audio your synthesizer exported and the playhead follows the real vocal. The file is read only on this device.', '音频': 'Audio', '播放打开的音频': 'Play the opened audio', '音频偏移（秒）': 'Audio offset (s)', '正值表示音频比谱面晚开始。': 'A positive value starts the audio after the score.', '移除音频': 'Remove audio', '正在准备播放…': 'Preparing playback…', '空格键播放或暂停，播放后点击谱面可跳转。': 'Space plays or pauses. Once playing, click the score to jump there.', '无法读取这个音频文件。': 'Could not read this audio file.', '此浏览器不支持音频播放。': 'This browser cannot play audio.', '音频文件超过 {size} MB。': 'The audio file is larger than {size} MB.', '无法保存音频，刷新后需重新打开。': 'The audio could not be saved; open it again after reloading.', '允许重叠': 'Allowed overlap', '不允许': 'None', '同时发声 ≤ {percent}%': 'Sung together ≤ {percent}%', '只合并人声声部：后面的声部与前面某一声部几乎不同时发声时，整句并入该声部。': 'Only vocal parts are merged: when a later part almost never sings together with an earlier one, its phrases move into that part whole.', '显示演唱者（声库）': 'Show singers (voice banks)', '{part}（{singer}）': '{part} ({singer})', '，{count} 个重叠音符留在原声部': '; {count} overlapping notes stay in their own part', '自动音高（仅供参考，不参与修正）：{curves} 条曲线，{count} 个音符的中段偏离 ≥ 阈值。': 'Automatic pitch (reference only, never applied): {curves} curves; {count} notes depart by at least the threshold in their middle.', '自动音高': 'Auto pitch', '查看整理明细': 'View merge details', '人声总谱': 'Vocal score', '准备就绪': 'Ready', '五线谱': 'Staff notation', '简谱': 'Numbered notation', '打印 / PDF': 'Print / PDF', '导出 MusicXML': 'Export MusicXML', '记谱方式': 'Notation', '乐段与和声分析': 'Phrase and harmony analysis', '重复乐段': 'Repeated phrases', '和弦候选': 'Chord candidates', '按小节': 'by measure', '歌词与声部文字': 'Lyrics and part text', '可修改或清空': 'Edit or clear', '音高微调': 'Pitch adjustment', '正在排版乐谱…': 'Engraving score…', '乐谱预览': 'Score preview', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': 'Preserves pitch, lyrics, meter, and tempo; notes crossing barlines are tied automatically.', 'SVG 乐谱预览': 'SVG score preview', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'Enable JavaScript to parse projects and create scores locally.',
    '声部': 'Part', '声部 {count}': 'Part {count}', '未命名声部': 'Unnamed part', 'SVP {version} · {count} 个声部': 'SVP {version} · {count} parts', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': 'Measure {measure} · beat {beat}', '小节 {measure} · {beat} + {fraction} 拍': 'Measure {measure} · beat {beat} + {fraction}', '位置 {beats} 拍': 'Position {beats} beats', '{count} 音符': '{count} notes', '音域 {low}–{high} · {transpose} 半音。{message}': 'Range {low}–{high} · {transpose} semitones. {message}', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output} parts; {count} notes moved upward', '{from} → {to}：{count} 个音符': '{from} → {to}: {count} notes', '存在重叠发声，可能为和声或叠唱': 'Overlapping voices; this may be harmony or doubled singing', '乐谱排版组件未能加载，请刷新页面后重试。': 'The score engraver failed to load. Refresh the page and try again.', '{parts} 声部 · {notes} 音符': '{parts} parts · {notes} notes', '{count} 小节': '{count} measures', '五线谱 · OpenSheetMusicDisplay': 'Staff notation · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': 'Numbered notation · scalable SVG', '请选择 .svp 工程文件。': 'Choose an .svp project file.', '文件超过 {size} MB，请缩小工程后再导入。': 'The file exceeds {size} MB. Reduce the project size before importing.', '工程中没有可转换的人声音符。': 'The project has no vocal notes to convert.', '人声谱': 'Vocal Score', '调性推测：{key}，可手动修改。': 'Estimated key: {key}. You can change it manually.', '音高信息不足以确定调性，请手动选择调号。': 'Not enough pitch information to estimate a key. Choose a key signature manually.', '请选择含音符的人声声部。': 'Select a vocal part that contains notes.', '调性推测 {before} → {after}。': 'Estimated key {before} → {after}.', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}.', '仍有 {count} 个音符超出目标音区。': '{count} notes remain outside the target range.', '音符均在目标音区内。': 'All notes fit the target range.', '{repeats} 组重复 · {chords} 处和弦候选': '{repeats} repeated groups · {chords} chord candidates', '{label} · {length} 小节 × {count}': '{label} · {length} measures × {count}', '旋律与节奏相同，歌词有差异': 'Melody and rhythm match; lyrics differ', '旋律、节奏与歌词相同': 'Melody, rhythm, and lyrics match', '未检测到至少两个小节的完全重复乐段。': 'No exact repeated phrase of at least two measures was found.', '{measure} 小节 · {beat} 拍': 'Measure {measure} · beat {beat}', '{label}的推测和弦': 'Inferred chord for {label}', '{symbol} · 匹配 {percent}%': '{symbol} · {percent}% match', '不标注': 'No annotation', '同时发声': 'Simultaneous notes', '音符汇总': 'Note summary', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': 'There is not enough pitch evidence for reliable chord candidates. A solo melody cannot uniquely determine harmony.', '{adjusted} 个音符修正 · {detuned} 个音分微调': '{adjusted} notes adjusted · {detuned} with note detune', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': 'Project: {points} pitch-curve points, {curves} other pitch curves; {explicit} notes with explicit expression, {inherited} with inherited expression.', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': 'Dynamic curves for {count} notes are reduced to a representative middle value; nonlinear curves use approximate sampling.', '来源声部 / 音符': 'Source part / note', '修正前': 'Before', '修正后': 'After', '代表偏移': 'Representative offset', '剩余音分': 'Residual cents', '{name} / {index}': '{name} / {index}', '显式': 'Explicit', '继承': 'Inherited', '声线': 'Voice', '查看滑音与颤音参数范围': 'View portamento and vibrato parameter ranges', '{name}：{low}–{high}（{count} 个音符）': '{name}: {low}–{high} ({count} notes)', '文件和设置保存在当前浏览器。': 'Files and settings are saved in this browser.', '本机浏览器数据被清除后无法恢复。': 'Saved content cannot be recovered if this browser’s data is cleared.', '清除浏览器数据会删除已存内容。': 'Clearing browser data deletes saved content.', '正在保存…': 'Saving…', '已保存在此浏览器': 'Saved in this browser', '保存失败': 'Save failed', '移除文件': 'Remove file', '已移除': 'Removed', '正在恢复文件…': 'Restoring files…', '正在恢复文件…': 'Restoring files…',
    '歌词与声部名称': 'Lyrics and part names', '清空本声部歌词': 'Clear lyrics in this part', '还原清空前内容': 'Restore lyrics before clearing', '修改会自动应用': 'Edits are applied automatically', '已修改': 'Edited', '选择声部': 'Select a part', '声部名称': 'Part name', '音符歌词': 'Note lyrics', '粘贴歌词文本': 'Paste lyrics', '粘贴文本处理方式': 'Pasted text mode', '处理方式': 'Mode', '拼音文本': 'Pinyin text', '汉字转拼音': 'Convert Hanzi to pinyin', '按全部音符对齐（包含空歌词位和延长位）': 'Align to every note (including empty lyric slots and extensions)', '应用替换': 'Apply replacement', '撤销上次替换': 'Undo last replacement', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': 'English is not accepted in Hanzi-to-pinyin mode. Switch to pinyin text mode.', '请粘贴中文汉字；英文文本不会转换。': 'Paste Chinese characters; English text is not converted.', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '{targets} notes to replace · {count} words pasted · counts match', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '{targets} notes to replace · {count} words generated · counts match', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '{targets} notes to replace · {count} words pasted · off by {difference}', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '{targets} notes to replace · {count} words generated · off by {difference}', '小节 {measure} · {beat}{fraction} 拍': 'Measure {measure} · beat {beat}{fraction}', '第 {index} 个音符歌词': 'Lyrics for note {index}', '清除第 {index} 个音符歌词': 'Clear lyrics for note {index}', '还原第 {index} 个音符歌词': 'Restore lyrics for note {index}', '时值 {duration}': 'Duration {duration}', '（空）': '(empty)', '（无对应音符）': '(no matching note)', '（缺少）': '(missing)', '仅预览前 {count} 项；总计 {total} 项。': 'Previewing {count} of {total} items.', '清除': 'Clear', '还原': 'Restore', '需要编辑容器和已解析的工程。': 'An editor container and parsed project are required.'
  },
  ja: {
    '返回主菜单': 'メインメニューに戻る', '返回 Tiny Projects 主菜单': 'Tiny Projects のメインメニューに戻る',
    '织音机首页': '織音機 ホーム', '文件仅在本机处理': 'ファイルはこの端末内で処理されます', '切换深色主题': 'ダークテーマに切り替え', '切换浅色主题': 'ライトテーマに切り替え', '深色': 'ダーク', '浅色': 'ライト', '界面语言': '表示言語', '转换设置': '変換設定', '选择或拖入 SVP': 'SVP ファイルを選択またはドロップ', '工程文件': 'プロジェクトファイル', '人声声部': 'ボーカルパート', '全选': 'すべて選択', '谱面设置': '楽譜設定', '乐谱标题': '楽譜タイトル', '节奏网格': 'リズムグリッド', '八分音符': '8分音符', '十六分音符': '16分音符', '三十二分音符': '32分音符', '移调': '移調', '降低半音': '半音下げる', '升高半音': '半音上げる', '半音': '半音', '目标音区': '目標音域', '较低 · C3–C5': '低め · C3–C5', '中间 · G3–G5': '中間 · G3–G5', '较高 · C4–C6': '高め · C4–C6', '自动移调': '自動移調', '字体与页面': 'フォントとページ', '谱面文字字体': '譜面テキストのフォント', '宋体 / 衬线': '明朝体 / セリフ', '黑体 / 无衬线': 'ゴシック体 / サンセリフ', '楷体': '楷書体', '等宽': '等幅', '歌词字号': '歌詞サイズ', '标题字号': 'タイトルサイズ', '每页页眉': '各ページのヘッダー', '可留空': '任意', '署名': 'クレジット', '首页标题下方': '1ページ目のタイトル下', '页眉 / 署名字号': 'ヘッダー / クレジットのサイズ', '页码': 'ページ番号', '小节号': '小節番号', '声部整理': 'パート整理', '合并分散独唱': '分散した独唱をまとめる', '记谱风格': '記譜スタイル', '风格预设': 'スタイルのプリセット', '流行旋律谱': 'ポップスのメロディー譜', '合唱谱（标准记谱）': '合唱譜（標準的な記譜）', '简洁': 'シンプル', '原样（不合并）': 'プロジェクトどおり（まとめない）', '自定义': 'カスタム', '自动 · 逐音识别': '自動 · 音ごとに判定', '；识别出 {glides} 处滑音、{ornaments} 处装饰音': '。スライド {glides} 箇所、装飾音 {ornaments} 箇所を検出', '滑音与装饰音': 'スライドと装飾音', '滑音线': 'スライド線', '倚音': '前打音', '并入前一音': '前の音にまとめる', '保留音符': '音符のまま残す', '花腔记法': 'メリスマの書き方', '延长线': '延長線', '连线': 'スラー', '连线 + 延长线': 'スラー + 延長線', '三连音标记': '三連符の表記', '括号与数字': '括弧と数字', '只写数字': '数字のみ', '重复时省略': '繰り返しは省略', '摇摆记法（Swing）': 'スウィング表記', '{count} 拍按摇摆记法写成平直八分音符': '{count} 拍をスウィング表記で均等な八分音符に', '摇摆记法把 ♩♪ 三连音写成平直八分音符，并在谱首标注 Swing。': 'スウィング表記では ♩♪ の三連符を均等な八分音符で書き、冒頭に Swing と表示します。', '允许合并不同声库': '異なるボイスバンクもまとめる', '织音机源代码': '織音機のソースコード', '第三方许可': 'サードパーティのライセンス', '自校': 'セルフチェック', '用本曲其他声部和前后同句的汉字补全拼音歌词': 'この曲の他のパートや前後の同じ句の漢字でピンインの歌詞を補う', '自校：用本曲补全拼音': 'セルフチェック：この曲からピンインを補う', '在本曲中找到 {count} 处拼音可以补成汉字：其他声部同时唱 {time} 处，前后同句 {context} 处。可以逐字选择，或全部采用。': 'この曲で漢字に直せるピンインが {count} か所あります（他のパートが同時に歌う {time} か所、前後の同じ句 {context} か所）。1 文字ずつ選ぶか、すべて採用できます。', '本曲中没有可以直接补全的拼音。': 'この曲には、そのまま補えるピンインはありません。', '第 {bar} 小节': '第 {bar} 小節', '保留拼音': 'ピンインのまま', '全部采用（{count}）': 'すべて採用（{count}）', '以后再说': '後で', '关闭': '閉じる', '已补 {count} 处 · 撤销': '{count} か所を補完 · 元に戻す', '{count} 处拼音可补汉字': '{count} か所のピンインに漢字候補', '逐个打开拼音歌词的候选汉字': 'ピンインの歌詞の漢字候補を順に開く', '歌曲': '曲', '歌曲列表': '曲の一覧', '已挂到 {count} 个工程': '{count} 件のプロジェクトに紐付け', '未挂接': '未紐付け', '挂到当前工程': '開いているプロジェクトに紐付け', '解除挂接': '紐付けを解除', '删除歌曲 {name}': '曲 {name} を削除', '删除歌曲': '曲を削除', '点击歌曲挂到当前工程，再点一次解除挂接；一首歌曲可挂到多个工程，各自记偏移。': '曲をクリックすると開いているプロジェクトに紐付け、もう一度クリックで解除します。1 曲を複数のプロジェクトで使え、ずれはプロジェクトごとに保存されます。', '解除挂接（歌曲仍保留，可挂到其他工程）': '紐付けを解除（曲は残り、他のプロジェクトに紐付けできます）', '挂接已有歌曲': '保存済みの曲を紐付け', '{track} 同时唱': '{track} が同時に歌う', '词语“{word}”': '語「{word}」', '第 {bar} 小节“{snippet}”': '第 {bar} 小節「{snippet}」', '有候选汉字，点击选择': '漢字の候補があります。クリックで選択', '候选汉字': '漢字の候補', '更多同音字（{reading}）': 'ほかの同音字（{reading}）', '同时替换其他声部同一位置的 {reading}（{count} 处）': '他のパートで同時に歌う {reading} も置き換え（{count} か所）', '本声部 {count} 处拼音按同时演唱的汉字填入': 'このパートのピンイン {count} か所を同時に歌われる漢字で埋める', '播放': '再生', '暂停': '一時停止', '回到开头': '先頭に戻る', '播放控制': '再生コントロール', '播放进度': '再生位置', '钢琴': 'ピアノ', '按谱用内置钢琴播放': '楽譜を内蔵ピアノで再生', '打开音频（推荐）': '音声を開く（おすすめ）', '打开合成器导出的音频，光标跟着真实人声走；文件只在本机读取。': 'シンセサイザーで書き出した音声を開くと、カーソルが実際の歌声に合わせて進みます。ファイルはこの端末内でのみ読み込みます。', '音频': '音声', '播放打开的音频': '開いた音声を再生', '音频偏移（秒）': '音声のずれ（秒）', '正值表示音频比谱面晚开始。': '正の値で音声が楽譜より遅れて始まります。', '移除音频': '音声を外す', '正在准备播放…': '再生を準備中…', '空格键播放或暂停，播放后点击谱面可跳转。': 'スペースキーで再生・一時停止。再生後は楽譜をクリックするとその位置へ移動します。', '无法读取这个音频文件。': 'この音声ファイルを読み込めません。', '此浏览器不支持音频播放。': 'このブラウザは音声の再生に対応していません。', '音频文件超过 {size} MB。': '音声ファイルが {size} MB を超えています。', '无法保存音频，刷新后需重新打开。': '音声を保存できませんでした。再読み込み後にもう一度開いてください。', '允许重叠': '許容する重なり', '不允许': 'なし', '同时发声 ≤ {percent}%': '同時に歌う割合 ≤ {percent}%', '只合并人声声部：后面的声部与前面某一声部几乎不同时发声时，整句并入该声部。': 'まとめるのは歌のパートだけです。後のパートが前のあるパートとほとんど同時に歌わないとき、フレーズ単位でそのパートに移します。', '显示演唱者（声库）': '歌い手（ボイスバンク）を表示', '{part}（{singer}）': '{part}（{singer}）', '，{count} 个重叠音符留在原声部': '、重なる {count} 音符は元のパートに残ります', '自动音高（仅供参考，不参与修正）：{curves} 条曲线，{count} 个音符的中段偏离 ≥ 阈值。': '自動ピッチ（参考のみ・補正には使いません）：カーブ {curves} 本、{count} 音符で中央部の偏差がしきい値以上です。', '自动音高': '自動ピッチ', '查看整理明细': '整理の詳細を見る', '人声总谱': 'ボーカル総譜', '准备就绪': '準備完了', '五线谱': '五線譜', '简谱': '数字譜', '打印 / PDF': '印刷 / PDF', '导出 MusicXML': 'MusicXML を書き出す', '记谱方式': '記譜方式', '乐段与和声分析': 'フレーズと和声の分析', '重复乐段': '反復フレーズ', '和弦候选': 'コード候補', '按小节': '小節ごと', '歌词与声部文字': '歌詞とパート名', '可修改或清空': '編集または消去', '音高微调': '音高の微調整', '正在排版乐谱…': '楽譜を組版中…', '乐谱预览': '楽譜プレビュー', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': '音高、歌詞、拍子、テンポを保持し、小節をまたぐ音符は自動でタイします。', 'SVG 乐谱预览': 'SVG 楽譜プレビュー', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'JavaScript を有効にすると、プロジェクトを端末内で解析して楽譜を作成できます。',
    '声部': 'パート', '声部 {count}': 'パート {count}', '未命名声部': '名前のないパート', 'SVP {version} · {count} 个声部': 'SVP {version} · {count} パート', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': '{measure} 小節 · {beat} 拍', '小节 {measure} · {beat} + {fraction} 拍': '{measure} 小節 · {beat} + {fraction} 拍', '位置 {beats} 拍': '位置 {beats} 拍', '{count} 音符': '{count} 音符', '音域 {low}–{high} · {transpose} 半音。{message}': '音域 {low}–{high} · {transpose} 半音。{message}', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output} パート、{count} 音符を上へ統合', '{from} → {to}：{count} 个音符': '{from} → {to}：{count} 音符', '存在重叠发声，可能为和声或叠唱': '音が重なっています。和声またはダブリングの可能性があります', '乐谱排版组件未能加载，请刷新页面后重试。': '楽譜組版コンポーネントを読み込めません。ページを更新して再試行してください。', '{parts} 声部 · {notes} 音符': '{parts} パート · {notes} 音符', '{count} 小节': '{count} 小節', '五线谱 · OpenSheetMusicDisplay': '五線譜 · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': '数字譜 · 拡大縮小できる SVG', '请选择 .svp 工程文件。': '.svp プロジェクトファイルを選択してください。', '文件超过 {size} MB，请缩小工程后再导入。': 'ファイルが {size} MB を超えています。プロジェクトを小さくしてから読み込んでください。', '工程中没有可转换的人声音符。': '変換できるボーカル音符がありません。', '人声谱': 'ボーカル譜', '调性推测：{key}，可手动修改。': '推定調性：{key}。手動で変更できます。', '音高信息不足以确定调性，请手动选择调号。': '調性を推定するには音高情報が不足しています。調号を選択してください。', '请选择含音符的人声声部。': '音符のあるボーカルパートを選択してください。', '调性推测 {before} → {after}。': '推定調性 {before} → {after}。', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}。', '仍有 {count} 个音符超出目标音区。': '{count} 音符が目標音域の外に残っています。', '音符均在目标音区内。': 'すべての音符が目標音域内です。', '{repeats} 组重复 · {chords} 处和弦候选': '反復 {repeats} 組 · コード候補 {chords} 件', '{label} · {length} 小节 × {count}': '{label} · {length} 小節 × {count}', '旋律与节奏相同，歌词有差异': '旋律とリズムは同じで歌詞が異なります', '旋律、节奏与歌词相同': '旋律・リズム・歌詞が同じです', '未检测到至少两个小节的完全重复乐段。': '2小節以上の完全な反復フレーズは見つかりませんでした。', '{measure} 小节 · {beat} 拍': '{measure} 小節 · {beat} 拍', '{label}的推测和弦': '{label} の推定コード', '{symbol} · 匹配 {percent}%': '{symbol} · 一致度 {percent}%', '不标注': '注記なし', '同时发声': '同時発音', '音符汇总': '音符の集計', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': '信頼できるコード候補を出すには音高情報が不足しています。独唱の旋律だけでは和声を一意に決められません。', '{adjusted} 个音符修正 · {detuned} 个音分微调': '{adjusted} 音符を修正 · {detuned} 音符にデチューンあり', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': 'プロジェクト：ピッチカーブ点 {points}、その他のピッチカーブ {curves} 本。明示的な表現値を持つ音符 {explicit}、継承値を持つ音符 {inherited}。', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': '{count} 音符の動的カーブは中央の代表値に簡略化されます。非線形カーブは近似サンプリングです。', '来源声部 / 音符': '元のパート / 音符', '修正前': '修正前', '修正后': '修正後', '代表偏移': '代表偏移', '剩余音分': '残りのセント', '{name} / {index}': '{name} / {index}', '显式': '明示', '继承': '継承', '声线': '声質', '查看滑音与颤音参数范围': 'ポルタメントとビブラートの値を見る', '{name}：{low}–{high}（{count} 个音符）': '{name}：{low}–{high}（{count} 音符）', '文件和设置保存在当前浏览器。': 'ファイルと設定はこのブラウザーに保存されます。', '本机浏览器数据被清除后无法恢复。': 'ブラウザーのデータを消去すると保存内容は復元できません。', '清除浏览器数据会删除已存内容。': 'ブラウザーのデータを消去すると保存内容が削除されます。', '正在保存…': '保存中…', '已保存在此浏览器': 'このブラウザーに保存しました', '保存失败': '保存に失敗しました', '移除文件': 'ファイルを削除', '已移除': '削除しました', '正在恢复文件…': 'ファイルを復元中…',
    '歌词与声部名称': '歌詞とパート名', '清空本声部歌词': 'このパートの歌詞を消去', '还原清空前内容': '消去前の歌詞に戻す', '修改会自动应用': '編集は自動で反映されます', '已修改': '編集済み', '选择声部': 'パートを選択', '声部名称': 'パート名', '音符歌词': '音符の歌詞', '粘贴歌词文本': '歌詞テキストを貼り付け', '粘贴文本处理方式': '貼り付けテキストの処理方法', '处理方式': '処理方法', '拼音文本': 'ピンインテキスト', '汉字转拼音': '漢字をピンインに変換', '按全部音符对齐（包含空歌词位和延长位）': 'すべての音符に合わせる（空欄と延長を含む）', '应用替换': '置換を適用', '撤销上次替换': '直前の置換を元に戻す', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': '漢字からピンインへの変換では英語を使えません。ピンインテキストに切り替えてください。', '请粘贴中文汉字；英文文本不会转换。': '中国語の漢字を貼り付けてください。英語は変換されません。', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '置換対象 {targets} 音符 · 貼り付け {count} 語 · 数が一致', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '置換対象 {targets} 音符 · 変換後 {count} 語 · 数が一致', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '置換対象 {targets} 音符 · 貼り付け {count} 語 · 差 {difference}', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '置換対象 {targets} 音符 · 変換後 {count} 語 · 差 {difference}', '小节 {measure} · {beat}{fraction} 拍': '{measure} 小節 · {beat}{fraction} 拍', '第 {index} 个音符歌词': '{index} 番目の音符の歌詞', '清除第 {index} 个音符歌词': '{index} 番目の音符の歌詞を消去', '还原第 {index} 个音符歌词': '{index} 番目の音符の歌詞を戻す', '时值 {duration}': '音価 {duration}', '（空）': '（空）', '（无对应音符）': '（対応する音符なし）', '（缺少）': '（不足）', '仅预览前 {count} 项；总计 {total} 项。': '先頭 {count} 件をプレビュー中（合計 {total} 件）。', '清除': '消去', '还原': '戻す', '需要编辑容器和已解析的工程。': '編集領域と解析済みプロジェクトが必要です。'
  },
  ko: {
    '返回主菜单': '메인 메뉴로 돌아가기', '返回 Tiny Projects 主菜单': 'Tiny Projects 메인 메뉴로 돌아가기',
    '织音机首页': '직음기 홈', '文件仅在本机处理': '파일은 이 기기에서 처리됩니다', '切换深色主题': '다크 테마로 전환', '切换浅色主题': '라이트 테마로 전환', '深色': '다크', '浅色': '라이트', '界面语言': '인터페이스 언어', '转换设置': '변환 설정', '选择或拖入 SVP': 'SVP 파일을 선택하거나 끌어 놓으세요', '工程文件': '프로젝트 파일', '人声声部': '보컬 파트', '全选': '모두 선택', '谱面设置': '악보 설정', '乐谱标题': '악보 제목', '节奏网格': '리듬 그리드', '八分音符': '8분음표', '十六分音符': '16분음표', '三十二分音符': '32분음표', '移调': '조옮김', '降低半音': '반음 낮추기', '升高半音': '반음 높이기', '半音': '반음', '目标音区': '목표 음역', '较低 · C3–C5': '낮음 · C3–C5', '中间 · G3–G5': '중간 · G3–G5', '较高 · C4–C6': '높음 · C4–C6', '自动移调': '자동 조옮김', '字体与页面': '글꼴과 페이지', '谱面文字字体': '악보 글꼴', '宋体 / 衬线': '명조 / 세리프', '黑体 / 无衬线': '고딕 / 산세리프', '楷体': '해서체', '等宽': '고정폭', '歌词字号': '가사 크기', '标题字号': '제목 크기', '每页页眉': '페이지 머리글', '可留空': '선택 사항', '署名': '작성자 표시', '首页标题下方': '첫 페이지 제목 아래', '页眉 / 署名字号': '머리글 / 작성자 크기', '页码': '페이지 번호', '小节号': '마디 번호', '声部整理': '파트 정리', '合并分散独唱': '분리된 독창 구간 합치기', '记谱风格': '기보 스타일', '风格预设': '스타일 프리셋', '流行旋律谱': '팝 멜로디 악보', '合唱谱（标准记谱）': '합창 악보(표준 기보)', '简洁': '간결', '原样（不合并）': '프로젝트 그대로(합치지 않음)', '自定义': '사용자 지정', '自动 · 逐音识别': '자동 · 음마다 판단', '；识别出 {glides} 处滑音、{ornaments} 处装饰音': '; 슬라이드 {glides}곳, 꾸밈음 {ornaments}곳 인식', '滑音与装饰音': '슬라이드와 꾸밈음', '滑音线': '슬라이드 선', '倚音': '앞꾸밈음', '并入前一音': '앞 음에 합치기', '保留音符': '음표로 남기기', '花腔记法': '멜리스마 표기', '延长线': '연장선', '连线': '이음줄', '连线 + 延长线': '이음줄 + 연장선', '三连音标记': '셋잇단음표 표기', '括号与数字': '괄호와 숫자', '只写数字': '숫자만', '重复时省略': '반복 시 생략', '摇摆记法（Swing）': '스윙 표기', '{count} 拍按摇摆记法写成平直八分音符': '{count}박을 스윙 표기로 고른 8분음표로 씀', '摇摆记法把 ♩♪ 三连音写成平直八分音符，并在谱首标注 Swing。': '스윙 표기는 ♩♪ 셋잇단음표를 고른 8분음표로 쓰고 첫머리에 Swing을 표시합니다.', '允许合并不同声库': '다른 보이스뱅크도 합치기', '织音机源代码': '직음기 소스 코드', '第三方许可': '서드파티 라이선스', '自校': '자체 교정', '用本曲其他声部和前后同句的汉字补全拼音歌词': '이 곡의 다른 파트와 앞뒤 같은 구절의 한자로 병음 가사 채우기', '自校：用本曲补全拼音': '자체 교정: 이 곡에서 병음 채우기', '在本曲中找到 {count} 处拼音可以补成汉字：其他声部同时唱 {time} 处，前后同句 {context} 处。可以逐字选择，或全部采用。': '이 곡에서 한자로 채울 수 있는 병음 {count}곳을 찾았습니다(다른 파트가 동시에 부름 {time}곳, 앞뒤 같은 구절 {context}곳). 한 글자씩 고르거나 모두 적용하세요.', '本曲中没有可以直接补全的拼音。': '이 곡에는 바로 채울 수 있는 병음이 없습니다.', '第 {bar} 小节': '{bar}마디', '保留拼音': '병음 유지', '全部采用（{count}）': '모두 적용({count})', '以后再说': '나중에', '关闭': '닫기', '已补 {count} 处 · 撤销': '{count}곳 채움 · 실행 취소', '{count} 处拼音可补汉字': '병음 {count}곳에 한자 후보', '逐个打开拼音歌词的候选汉字': '병음 가사의 한자 후보를 차례로 열기', '歌曲': '곡', '歌曲列表': '곡 목록', '已挂到 {count} 个工程': '프로젝트 {count}개에 연결됨', '未挂接': '연결 안 됨', '挂到当前工程': '열린 프로젝트에 연결', '解除挂接': '연결 해제', '删除歌曲 {name}': '곡 {name} 삭제', '删除歌曲': '곡 삭제', '点击歌曲挂到当前工程，再点一次解除挂接；一首歌曲可挂到多个工程，各自记偏移。': '곡을 클릭하면 열린 프로젝트에 연결되고, 다시 클릭하면 해제됩니다. 한 곡을 여러 프로젝트에서 쓸 수 있으며 오프셋은 프로젝트마다 저장됩니다.', '解除挂接（歌曲仍保留，可挂到其他工程）': '연결 해제(곡은 남아 다른 프로젝트에 연결할 수 있음)', '挂接已有歌曲': '저장된 곡 연결', '{track} 同时唱': '{track} 동시에 부름', '词语“{word}”': '단어 “{word}”', '第 {bar} 小节“{snippet}”': '{bar}마디 “{snippet}”', '有候选汉字，点击选择': '한자 후보가 있습니다. 클릭하여 선택', '候选汉字': '한자 후보', '更多同音字（{reading}）': '다른 동음 글자({reading})', '同时替换其他声部同一位置的 {reading}（{count} 处）': '다른 파트에서 동시에 부르는 {reading}도 바꾸기({count}곳)', '本声部 {count} 处拼音按同时演唱的汉字填入': '이 파트의 병음 {count}곳을 동시에 부르는 한자로 채우기', '播放': '재생', '暂停': '일시정지', '回到开头': '처음으로', '播放控制': '재생 컨트롤', '播放进度': '재생 위치', '钢琴': '피아노', '按谱用内置钢琴播放': '악보를 내장 피아노로 재생', '打开音频（推荐）': '오디오 열기(추천)', '打开合成器导出的音频，光标跟着真实人声走；文件只在本机读取。': '합성기에서 내보낸 오디오를 열면 커서가 실제 보컬을 따라갑니다. 파일은 이 기기에서만 읽습니다.', '音频': '오디오', '播放打开的音频': '연 오디오 재생', '音频偏移（秒）': '오디오 오프셋(초)', '正值表示音频比谱面晚开始。': '양수이면 오디오가 악보보다 늦게 시작합니다.', '移除音频': '오디오 제거', '正在准备播放…': '재생 준비 중…', '空格键播放或暂停，播放后点击谱面可跳转。': '스페이스 키로 재생·일시정지합니다. 재생 후 악보를 클릭하면 그 위치로 이동합니다.', '无法读取这个音频文件。': '이 오디오 파일을 읽을 수 없습니다.', '此浏览器不支持音频播放。': '이 브라우저는 오디오 재생을 지원하지 않습니다.', '音频文件超过 {size} MB。': '오디오 파일이 {size}MB를 넘습니다.', '无法保存音频，刷新后需重新打开。': '오디오를 저장하지 못했습니다. 새로 고친 뒤 다시 여세요.', '允许重叠': '허용할 겹침', '不允许': '허용 안 함', '同时发声 ≤ {percent}%': '동시에 부르는 비율 ≤ {percent}%', '只合并人声声部：后面的声部与前面某一声部几乎不同时发声时，整句并入该声部。': '보컬 파트만 합칩니다. 뒤 파트가 앞의 한 파트와 거의 동시에 부르지 않으면 프레이즈 단위로 그 파트에 옮깁니다.', '显示演唱者（声库）': '가수(보이스뱅크) 표시', '{part}（{singer}）': '{part} ({singer})', '，{count} 个重叠音符留在原声部': ', 겹치는 음표 {count}개는 원래 파트에 남습니다', '自动音高（仅供参考，不参与修正）：{curves} 条曲线，{count} 个音符的中段偏离 ≥ 阈值。': '자동 피치(참고용, 보정에 사용하지 않음): 곡선 {curves}개, 음표 {count}개에서 중간 부분 편차가 임계값 이상입니다.', '自动音高': '자동 피치', '查看整理明细': '정리 내역 보기', '人声总谱': '보컬 총보', '准备就绪': '준비 완료', '五线谱': '오선보', '简谱': '숫자 악보', '打印 / PDF': '인쇄 / PDF', '导出 MusicXML': 'MusicXML 내보내기', '记谱方式': '기보 방식', '乐段与和声分析': '악구 및 화성 분석', '重复乐段': '반복 악구', '和弦候选': '코드 후보', '按小节': '마디별', '歌词与声部文字': '가사와 파트 이름', '可修改或清空': '수정 또는 지우기', '音高微调': '음높이 미세 조정', '正在排版乐谱…': '악보 조판 중…', '乐谱预览': '악보 미리보기', '保留音高、歌词、拍号与速度，跨小节音符自动连线。': '음높이, 가사, 박자표, 템포를 유지하고 마디를 넘는 음표는 자동으로 타이 처리합니다.', 'SVG 乐谱预览': 'SVG 악보 미리보기', '请启用 JavaScript，以在本地解析工程并生成乐谱。': 'JavaScript를 활성화하면 프로젝트를 이 기기에서 분석하고 악보를 만들 수 있습니다.',
    '声部': '파트', '声部 {count}': '파트 {count}', '未命名声部': '이름 없는 파트', 'SVP {version} · {count} 个声部': 'SVP {version} · 파트 {count}개', 'SVP {version}': 'SVP {version}', '小节 {measure} · {beat} 拍': '{measure}마디 · {beat}박', '小节 {measure} · {beat} + {fraction} 拍': '{measure}마디 · {beat} + {fraction}박', '位置 {beats} 拍': '위치 {beats}박', '{count} 音符': '음표 {count}개', '音域 {low}–{high} · {transpose} 半音。{message}': '음역 {low}–{high} · {transpose}반음. {message}', '{source} → {output} 个谱表，{count} 个音符向上合并': '{source} → {output}파트, 음표 {count}개를 위 파트로 이동', '{from} → {to}：{count} 个音符': '{from} → {to}: 음표 {count}개', '存在重叠发声，可能为和声或叠唱': '음이 겹칩니다. 화성 또는 더블링일 수 있습니다', '乐谱排版组件未能加载，请刷新页面后重试。': '악보 조판 구성 요소를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.', '{parts} 声部 · {notes} 音符': '파트 {parts}개 · 음표 {notes}개', '{count} 小节': '마디 {count}개', '五线谱 · OpenSheetMusicDisplay': '오선보 · OpenSheetMusicDisplay', '简谱 · 可缩放 SVG': '숫자 악보 · 확대 가능한 SVG', '请选择 .svp 工程文件。': '.svp 프로젝트 파일을 선택하세요.', '文件超过 {size} MB，请缩小工程后再导入。': '파일이 {size}MB를 초과합니다. 프로젝트 크기를 줄인 뒤 가져오세요.', '工程中没有可转换的人声音符。': '변환할 보컬 음표가 없습니다.', '人声谱': '보컬 악보', '调性推测：{key}，可手动修改。': '추정 조성: {key}. 직접 변경할 수 있습니다.', '音高信息不足以确定调性，请手动选择调号。': '조성을 추정하기에 음높이 정보가 부족합니다. 조표를 직접 선택하세요.', '请选择含音符的人声声部。': '음표가 있는 보컬 파트를 선택하세요.', '调性推测 {before} → {after}。': '추정 조성 {before} → {after}.', '{low}–{high} → {newLow}–{newHigh}。': '{low}–{high} → {newLow}–{newHigh}.', '仍有 {count} 个音符超出目标音区。': '음표 {count}개가 목표 음역을 벗어납니다.', '音符均在目标音区内。': '모든 음표가 목표 음역 안에 있습니다.', '{repeats} 组重复 · {chords} 处和弦候选': '반복 {repeats}개 · 코드 후보 {chords}개', '{label} · {length} 小节 × {count}': '{label} · {length}마디 × {count}', '旋律与节奏相同，歌词有差异': '선율과 리듬은 같고 가사는 다릅니다', '旋律、节奏与歌词相同': '선율, 리듬, 가사가 같습니다', '未检测到至少两个小节的完全重复乐段。': '두 마디 이상 완전히 반복되는 악구가 없습니다.', '{measure} 小节 · {beat} 拍': '{measure}마디 · {beat}박', '{label}的推测和弦': '{label}의 추정 코드', '{symbol} · 匹配 {percent}%': '{symbol} · 일치 {percent}%', '不标注': '표시 안 함', '同时发声': '동시 발음', '音符汇总': '음표 집계', '没有足够音高支持可靠的和弦候选。独唱旋律无法唯一决定和声。': '신뢰할 만한 코드 후보를 만들 음높이 정보가 부족합니다. 독창 선율만으로 화성을 하나로 정할 수 없습니다.', '{adjusted} 个音符修正 · {detuned} 个音分微调': '음표 {adjusted}개 조정 · detune 음표 {detuned}개', '工程：{points} 个音高曲线控制点，{curves} 条其他音高曲线；{explicit} 个音符带显式表现参数，{inherited} 个带继承参数。': '프로젝트: 피치 곡선 제어점 {points}개, 기타 피치 곡선 {curves}개. 명시적 표현값이 있는 음표 {explicit}개, 상속값이 있는 음표 {inherited}개.', '{count} 个音符的动态曲线简化为中段代表值；非线性曲线使用近似采样。': '음표 {count}개의 동적 곡선을 중간 대표값으로 단순화합니다. 비선형 곡선은 근사 샘플링을 사용합니다.', '来源声部 / 音符': '원본 파트 / 음표', '修正前': '수정 전', '修正后': '수정 후', '代表偏移': '대표 편차', '剩余音分': '잔여 센트', '{name} / {index}': '{name} / {index}', '显式': '명시', '继承': '상속', '声线': '음성', '查看滑音与颤音参数范围': '포르타멘토 및 비브라토 값 범위 보기', '{name}：{low}–{high}（{count} 个音符）': '{name}: {low}–{high} (음표 {count}개)', '文件和设置保存在当前浏览器。': '파일과 설정은 현재 브라우저에 저장됩니다.', '本机浏览器数据被清除后无法恢复。': '이 브라우저 데이터를 지우면 저장 내용을 복구할 수 없습니다.', '清除浏览器数据会删除已存内容。': '브라우저 데이터를 지우면 저장된 내용이 삭제됩니다.', '正在保存…': '저장 중…', '已保存在此浏览器': '이 브라우저에 저장됨', '保存失败': '저장 실패', '移除文件': '파일 제거', '已移除': '제거됨', '正在恢复文件…': '파일 복원 중…',
    '歌词与声部名称': '가사와 파트 이름', '清空本声部歌词': '이 파트 가사 지우기', '还原清空前内容': '지우기 전 가사 복원', '修改会自动应用': '수정 사항이 자동 적용됩니다', '已修改': '수정됨', '选择声部': '파트 선택', '声部名称': '파트 이름', '音符歌词': '음표 가사', '粘贴歌词文本': '가사 텍스트 붙여넣기', '粘贴文本处理方式': '붙여넣은 텍스트 처리 방식', '处理方式': '처리 방식', '拼音文本': '병음 텍스트', '汉字转拼音': '한자를 병음으로 변환', '按全部音符对齐（包含空歌词位和延长位）': '모든 음표에 맞춤(빈 가사 칸과 연장 칸 포함)', '应用替换': '바꾸기 적용', '撤销上次替换': '마지막 바꾸기 실행 취소', '汉字转拼音模式不接受英文；请切换到拼音文本模式。': '한자-병음 변환에서는 영어를 사용할 수 없습니다. 병음 텍스트 모드로 전환하세요.', '请粘贴中文汉字；英文文本不会转换。': '중국어 한자를 붙여넣으세요. 영어 텍스트는 변환되지 않습니다.', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量匹配': '바꿀 음표 {targets}개 · 붙여넣은 단어 {count}개 · 개수 일치', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量匹配': '바꿀 음표 {targets}개 · 변환된 단어 {count}개 · 개수 일치', '待替换 {targets} 个音符 · 粘贴 {count} 个词 · 数量差 {difference} 个': '바꿀 음표 {targets}개 · 붙여넣은 단어 {count}개 · 차이 {difference}개', '待替换 {targets} 个音符 · 转换得 {count} 个词 · 数量差 {difference} 个': '바꿀 음표 {targets}개 · 변환된 단어 {count}개 · 차이 {difference}개', '小节 {measure} · {beat}{fraction} 拍': '{measure}마디 · {beat}{fraction}박', '第 {index} 个音符歌词': '{index}번째 음표 가사', '清除第 {index} 个音符歌词': '{index}번째 음표 가사 지우기', '还原第 {index} 个音符歌词': '{index}번째 음표 가사 복원', '时值 {duration}': '길이 {duration}', '（空）': '(비어 있음)', '（无对应音符）': '(해당 음표 없음)', '（缺少）': '(누락)', '仅预览前 {count} 项；总计 {total} 项。': '{total}개 중 처음 {count}개 미리보기.', '清除': '지우기', '还原': '복원', '需要编辑容器和已解析的工程。': '편집 영역과 파싱된 프로젝트가 필요합니다.'
  }
};

const aliases = {
  'zh-CN': {
    '正在生成 PDF…': '正在生成 PDF…',
    '拖动排序': '拖动排序', '上移': '上移', '下移': '下移',
    'svp.warning.snapped': '{track}：{count} 个过短音符在当前节奏网格上并入相邻音符。', '考虑调校参数': '考虑调校参数',
    '加载制谱引擎': '加载制谱引擎', '准备字体': '准备字体', '加载歌词编辑器': '加载歌词编辑器', '准备歌词匹配 Worker': '准备歌词匹配 Worker', '准备 PDF 导出 Worker': '准备 PDF 导出 Worker', '仍在准备，可先进入': '仍在准备，可先进入', '此浏览器不支持 Worker，歌词匹配在主线程运行': '此浏览器不支持 Worker，歌词匹配在主线程运行', '五线谱暂不可用，简谱仍可使用': '五线谱暂不可用，简谱仍可使用', '此浏览器无法在后台生成 PDF': '此浏览器无法在后台生成 PDF', '准备就绪': '准备就绪', '正在启动': '正在启动',
    '主菜单': '主菜单',
    '合并连续音符': '合并连续音符', '不合并': '不合并', '低 · 同音延长': '低 · 同音延长', '中 · 含元音续唱': '中 · 含元音续唱', '高 · 含短装饰音': '高 · 含短装饰音', '{count} 个续唱音符并入前一字': '{count} 个续唱音符并入前一字',
    '感谢奥莉安多提供的样本数据和改善建议': '感谢奥莉安多提供的样本数据和改善建议',
    '选择或拖入工程': '选择或拖入工程', '不支持此文件类型。': '不支持此文件类型。', '工程中没有可转换的音符。': '工程中没有可转换的音符。', '{format} · {count} 个声部': '{format} · {count} 个声部', 'import.error.unsupported': '不支持此文件类型：{name}', 'import.error.invalid': '无法读取 {format} 工程。{detail}',
    '识别转调': '识别转调', '识别三连音': '识别三连音', '转换提示': '转换提示', '{count} 条': '{count} 条', '整体': '整体', '{count} 条提示': '{count} 条提示', '在分析页查看转换提示': '在分析页查看转换提示', '第 {measure} 小节转为 {key}': '第 {measure} 小节转为 {key}', '页边距 (mm)': '页边距 (mm)',
    '导出 SVG': '导出 SVG', '缩放': '缩放', '文件和设置保存在当前浏览器': '文件和设置保存在当前浏览器',
    '点击谱面文字可编辑': '点击谱面文字可编辑', '修改谱面文字': '修改谱面文字', '保存文字': '保存文字', '取消编辑': '取消编辑', '编辑 {text}': '编辑 {text}', '谱面文字编辑': '谱面文字编辑',
    '工作区导航': '工作区导航', '工作区栏目': '工作区栏目', '展开侧栏': '展开侧栏', '收起侧栏': '收起侧栏', '关闭工作区栏目': '关闭工作区栏目', '打开工作区栏目': '打开工作区栏目', 
    'lyricEditor.title': '歌词与声部名称', 'lyricEditor.correctTitle': '粘贴正确歌词', 'lyricEditor.correctPlaceholder': '粘贴整首正确歌词。不用管顺序、分段和换行，会自动对到谱里每个声部的音符。', 'lyricEditor.writeAs': '写入', 'lyricEditor.writeText': '原文', 'lyricEditor.writeReading': '拼音', 'lyricEditor.markChange': '将修正 {count}', 'lyricEditor.markSame': '已一致 {count}', 'lyricEditor.markLow': '读音不同 {count}', 'lyricEditor.markNone': '谱中没有 {count}', 'lyricEditor.caretNone': '「{text}」谱中没有', 'lyricEditor.caretHint': '把光标放在字上，可以看到它对到哪个声部的哪个音符。', 'lyricEditor.voiceSummary': '修正 {changed} · 对上 {matched}/{syllables}', 'lyricEditor.uncovered': '未对上 {count}：', 'lyricEditor.correctCount': '修正 {count} 个音符', 'lyricEditor.noChange': '没有要修正的音符', 'lyricEditor.editNotes': '逐字修改', 'lyricEditor.beats': '{beats} 拍', 'lyricEditor.clearAll': '清空本声部歌词', 'lyricEditor.restoreAll': '还原清空前内容', 'lyricEditor.undoBatch': '撤销上次替换', 'lyricEditor.noteLyric': '第 {index} 个音符歌词', 'lyricEditor.position': "小节 {bar} · {beat} 拍", 'lyricEditor.noVoice': '（无对应音符）',
    "织音机": "织音机",
    "调号": "调号",
    "大调": "大调",
    "小调": "小调",
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
    "上一页": "上一页",
    "下一页": "下一页",
    "适合页面": "适合页面",
    "第 {page} 页，共 {total} 页": "第 {page} 页，共 {total} 页",
    "下载 PDF": "下载 PDF",
    "方向": "方向",
    "横向": "横向",
    "纵向": "纵向",
    "纸张": "纸张",
    "适合页宽": "适合页宽",
    "svp.warning.missingGroup": "{track}：未找到音符组 {group}。",
    "svp.warning.invalidNote": "{track}：已跳过起始位置、时值或音高无效的音符。",
    "svp.warning.invalidDetune": "{track}：已忽略非有限的音符微调值。",
    "svp.warning.pitchControls": "{track}：音高控制曲线无法写入 MusicXML。",
    "svp.warning.linearCurve": "{track}：音高曲线使用线性采样近似来调整音符。",
    "svp.warning.representativeCurve": "{track}：音高曲线形状简化为每个音符的代表值。",
    "svp.warning.residual": "{track}：{count} 个音符的剩余音分作为元数据保留，未写入乐谱。",
    "svp.warning.swingStraight": "Swing 记法：{count} 拍为平直八分音符，会被读成摇摆。",
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
    '正在生成 PDF…': 'Generating PDF…',
    '拖动排序': 'Drag to reorder', '上移': 'Move up', '下移': 'Move down',
    'svp.warning.snapped': '{track}: {count} very short notes were merged into a neighbouring note at this rhythm grid.', '考虑调校参数': 'Use tuning parameters',
    '加载制谱引擎': 'Loading the notation engine', '准备字体': 'Preparing fonts', '加载歌词编辑器': 'Loading the lyric editor', '准备歌词匹配 Worker': 'Starting the lyric matching worker', '准备 PDF 导出 Worker': 'Starting the PDF export worker', '仍在准备，可先进入': 'Still preparing; you can go in now', '此浏览器不支持 Worker，歌词匹配在主线程运行': 'This browser has no workers; lyric matching runs on the page', '五线谱暂不可用，简谱仍可使用': 'Staff notation is unavailable for now; numbered notation still works', '此浏览器无法在后台生成 PDF': 'This browser cannot build PDFs in the background', '准备就绪': 'READY', '正在启动': 'STARTING',
    '主菜单': 'Main menu',
    '合并连续音符': 'Join consecutive notes', '不合并': 'Off', '低 · 同音延长': 'Low · same-pitch extensions', '中 · 含元音续唱': 'Medium · plus repeated vowels', '高 · 含短装饰音': 'High · plus short ornaments', '{count} 个续唱音符并入前一字': '{count} continuation notes folded into the previous syllable',
    '感谢奥莉安多提供的样本数据和改善建议': 'Thanks to 奥莉安多 for sample data and suggestions for improvement',
    '选择或拖入工程': 'Choose or drop project files', '不支持此文件类型。': 'This file type is not supported.', '工程中没有可转换的音符。': 'The project has no notes to convert.', '{format} · {count} 个声部': '{format} · {count} parts', 'import.error.unsupported': 'Unsupported file type: {name}', 'import.error.invalid': 'Could not read the {format} project. {detail}',
    '识别转调': 'Detect key changes', '识别三连音': 'Detect triplets', '转换提示': 'Conversion notes', '{count} 条': '{count}', '整体': 'Whole score', '{count} 条提示': '{count} notes', '在分析页查看转换提示': 'View conversion notes on the analysis page', '第 {measure} 小节转为 {key}': 'Measure {measure}: key changes to {key}', '页边距 (mm)': 'Page margin (mm)',
    '导出 SVG': 'Export SVG', '缩放': 'Zoom', '文件和设置保存在当前浏览器': 'Files and settings are saved in this browser',
    '点击谱面文字可编辑': 'Click score text to edit', '修改谱面文字': 'Edit score text', '保存文字': 'Save text', '取消编辑': 'Cancel editing', '编辑 {text}': 'Edit {text}', '谱面文字编辑': 'Score text editor',
    '工作区导航': 'Workspace navigation', '工作区栏目': 'Workspace sections', '工程文件': 'Projects', '谱面设置': 'Score settings', '乐段与和声分析': 'Analysis', '歌词与声部文字': 'Lyrics', '音高微调': 'Pitch tuning', '展开侧栏': 'Expand sidebar', '收起侧栏': 'Collapse sidebar', '关闭工作区栏目': 'Close workspace sections', '打开工作区栏目': 'Open workspace sections', 
    'lyricEditor.title': 'Lyrics and part names', 'lyricEditor.correctTitle': 'Paste the correct lyrics', 'lyricEditor.correctPlaceholder': 'Paste the whole correct lyrics. Order, paragraphs and line breaks do not matter: every voice is matched automatically.', 'lyricEditor.writeAs': 'Write', 'lyricEditor.writeText': 'As pasted', 'lyricEditor.writeReading': 'Pinyin', 'lyricEditor.markChange': 'To correct {count}', 'lyricEditor.markSame': 'Already right {count}', 'lyricEditor.markLow': 'Different reading {count}', 'lyricEditor.markNone': 'Not in the score {count}', 'lyricEditor.caretNone': '“{text}” is not sung in the score', 'lyricEditor.caretHint': 'Put the cursor on a character to see which note it matches in each voice.', 'lyricEditor.voiceSummary': 'correct {changed} · matched {matched}/{syllables}', 'lyricEditor.uncovered': '{count} unmatched:', 'lyricEditor.correctCount': 'Correct {count} notes', 'lyricEditor.noChange': 'Nothing to correct', 'lyricEditor.editNotes': 'Edit note by note', 'lyricEditor.beats': '{beats} beats', 'lyricEditor.clearAll': 'Clear lyrics in this part', 'lyricEditor.restoreAll': 'Restore lyrics before clearing', 'lyricEditor.undoBatch': 'Undo last replacement', 'lyricEditor.noteLyric': 'Lyrics for note {index}', 'lyricEditor.position': "Measure {bar} · beat {beat}", 'lyricEditor.noVoice': '(no matching note)',
    "织音机": "Sound Loom",
    "调号": "Key signature",
    "大调": "major",
    "小调": "minor",
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
    "上一页": "Previous page",
    "下一页": "Next page",
    "适合页面": "Fit page",
    "第 {page} 页，共 {total} 页": "Page {page} of {total}",
    "下载 PDF": "Download PDF",
    "方向": "Orientation",
    "横向": "Landscape",
    "纵向": "Portrait",
    "纸张": "Paper size",
    "适合页宽": "Fit width",
    "svp.warning.missingGroup": "{track}: note group {group} was not found.",
    "svp.warning.invalidNote": "{track}: skipped a note with invalid onset, duration, or pitch.",
    "svp.warning.invalidDetune": "{track}: ignored a non-finite note detune value.",
    "svp.warning.pitchControls": "{track}: pitch control curves cannot be represented in MusicXML.",
    "svp.warning.linearCurve": "{track}: a linear sampling approximation was used to adjust notes from the pitch curve.",
    "svp.warning.representativeCurve": "{track}: pitch curve shape was reduced to one representative value per note.",
    "svp.warning.residual": "{track}: {count} notes keep their remaining cents as metadata, not engraved.",
    "svp.warning.swingStraight": "Swing notation: {count} beats have straight eighths that will read as swung.",
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
    '正在生成 PDF…': 'PDFを生成中…',
    '拖动排序': 'ドラッグで並べ替え', '上移': '上へ移動', '下移': '下へ移動',
    'svp.warning.snapped': '{track}：短すぎる {count} 個のノートを、このリズムグリッドで隣のノートにまとめました。', '考虑调校参数': '調声パラメータを反映',
    '加载制谱引擎': '記譜エンジンを読み込み中', '准备字体': 'フォントを準備中', '加载歌词编辑器': '歌詞エディターを読み込み中', '准备歌词匹配 Worker': '歌詞照合 Worker を準備中', '准备 PDF 导出 Worker': 'PDF 書き出し Worker を準備中', '仍在准备，可先进入': 'まだ準備中です。先に入れます', '此浏览器不支持 Worker，歌词匹配在主线程运行': 'このブラウザーは Worker に対応していないため、歌詞照合はページ上で実行します', '五线谱暂不可用，简谱仍可使用': '五線譜は現在使えません。数字譜は使えます', '此浏览器无法在后台生成 PDF': 'このブラウザーではバックグラウンドで PDF を作成できません', '准备就绪': '準備完了', '正在启动': '起動中',
    '主菜单': 'メニュー',
    '合并连续音符': '連続するノートを結合', '不合并': '結合しない', '低 · 同音延长': '低 · 同じ音高の延長', '中 · 含元音续唱': '中 · 母音の続きも', '高 · 含短装饰音': '高 · 短い装飾音も', '{count} 个续唱音符并入前一字': '{count} 個の続きのノートを前の音節にまとめました',
    '感谢奥莉安多提供的样本数据和改善建议': 'サンプルデータと改善案を提供してくださった奥莉安多さんに感謝します',
    '选择或拖入工程': 'プロジェクトを選択またはドロップ', '不支持此文件类型。': 'このファイル形式には対応していません。', '工程中没有可转换的音符。': '変換できるノートがありません。', '{format} · {count} 个声部': '{format} · {count} パート', 'import.error.unsupported': '対応していないファイル形式です：{name}', 'import.error.invalid': '{format} プロジェクトを読み込めませんでした。{detail}',
    '识别转调': '転調を検出', '识别三连音': '3連符を検出', '转换提示': '変換メモ', '{count} 条': '{count} 件', '整体': '全体', '{count} 条提示': 'メモ {count} 件', '在分析页查看转换提示': '分析ページで変換メモを見る', '第 {measure} 小节转为 {key}': '{measure} 小節目で {key} に転調', '页边距 (mm)': '余白 (mm)',
    '导出 SVG': 'SVG を書き出す', '缩放': '拡大率', '文件和设置保存在当前浏览器': 'ファイルと設定はこのブラウザーに保存されます',
    '点击谱面文字可编辑': '譜面の文字をクリックして編集', '修改谱面文字': '譜面の文字を編集', '保存文字': 'テキストを保存', '取消编辑': '編集をキャンセル', '编辑 {text}': '{text}を編集', '谱面文字编辑': '譜面テキストエディター',
    '工作区导航': 'ワークスペース ナビゲーション', '工作区栏目': 'ワークスペース セクション', '工程文件': 'プロジェクト', '谱面设置': '譜面設定', '乐段与和声分析': '分析', '歌词与声部文字': '歌詞', '音高微调': 'ピッチ調整', '展开侧栏': 'サイドバーを展開', '收起侧栏': 'サイドバーを折りたたむ', '关闭工作区栏目': 'ワークスペースのセクションを閉じる', '打开工作区栏目': 'ワークスペースのセクションを開く', 
    'lyricEditor.title': '歌詞とパート名', 'lyricEditor.correctTitle': '正しい歌詞を貼り付け', 'lyricEditor.correctPlaceholder': '正しい歌詞を丸ごと貼り付けてください。順序・段落・改行は気にせず、各パートのノートに自動で合わせます。', 'lyricEditor.writeAs': '書き込み', 'lyricEditor.writeText': '原文', 'lyricEditor.writeReading': 'ピンイン', 'lyricEditor.markChange': '修正予定 {count}', 'lyricEditor.markSame': '一致 {count}', 'lyricEditor.markLow': '読みが異なる {count}', 'lyricEditor.markNone': '譜面にない {count}', 'lyricEditor.caretNone': '「{text}」は譜面にありません', 'lyricEditor.caretHint': '文字にカーソルを置くと、各パートのどのノートに対応するか表示します。', 'lyricEditor.voiceSummary': '修正 {changed} · 一致 {matched}/{syllables}', 'lyricEditor.uncovered': '未対応 {count}：', 'lyricEditor.correctCount': '{count} 個のノートを修正', 'lyricEditor.noChange': '修正するノートはありません', 'lyricEditor.editNotes': 'ノートごとに編集', 'lyricEditor.beats': '{beats} 拍', 'lyricEditor.clearAll': 'このパートの歌詞を消去', 'lyricEditor.restoreAll': '消去前の歌詞に戻す', 'lyricEditor.undoBatch': '前回の置換を元に戻す', 'lyricEditor.noteLyric': '{index} 番目の音符の歌詞', 'lyricEditor.position': "{bar} 小節 · {beat} 拍", 'lyricEditor.noVoice': '（該当する音符なし）',
    "织音机": "織音機",
    "调号": "調号",
    "大调": "長調",
    "小调": "短調",
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
    "上一页": "前のページ",
    "下一页": "次のページ",
    "适合页面": "ページに合わせる",
    "第 {page} 页，共 {total} 页": "{total} ページ中 {page} ページ目",
    "下载 PDF": "PDF をダウンロード",
    "方向": "向き",
    "横向": "横向き",
    "纵向": "縦向き",
    "纸张": "用紙サイズ",
    "适合页宽": "幅に合わせる",
    "svp.warning.missingGroup": "{track}：音符グループ {group} が見つかりません。",
    "svp.warning.invalidNote": "{track}：開始位置、長さ、音高が無効な音符を除外しました。",
    "svp.warning.invalidDetune": "{track}：有限値ではない音符の微調整を無視しました。",
    "svp.warning.pitchControls": "{track}：ピッチ制御カーブは MusicXML で表現できません。",
    "svp.warning.linearCurve": "{track}：ピッチカーブから音符を調整する際、線形サンプリング近似を使いました。",
    "svp.warning.representativeCurve": "{track}：ピッチカーブの形状を音符ごとの代表値に簡略化しました。",
    "svp.warning.residual": "{track}：{count} 音符の残りのセント差はメタデータとして保持し、楽譜には記譜しません。",
    "svp.warning.swingStraight": "Swing 表記：{count} 拍は均等な八分音符のため、跳ねて読まれます。",
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
    '正在生成 PDF…': 'PDF 생성 중…',
    '拖动排序': '끌어서 순서 변경', '上移': '위로 이동', '下移': '아래로 이동',
    'svp.warning.snapped': '{track}: 너무 짧은 음표 {count}개를 현재 리듬 격자에서 이웃 음표에 합쳤습니다.', '考虑调校参数': '조율 파라미터 반영',
    '加载制谱引擎': '악보 엔진 불러오는 중', '准备字体': '글꼴 준비 중', '加载歌词编辑器': '가사 편집기 불러오는 중', '准备歌词匹配 Worker': '가사 맞춤 Worker 준비 중', '准备 PDF 导出 Worker': 'PDF 내보내기 Worker 준비 중', '仍在准备，可先进入': '아직 준비 중이지만 먼저 들어갈 수 있습니다', '此浏览器不支持 Worker，歌词匹配在主线程运行': '이 브라우저는 Worker를 지원하지 않아 가사 맞춤을 페이지에서 실행합니다', '五线谱暂不可用，简谱仍可使用': '오선보는 지금 사용할 수 없습니다. 숫자보는 사용할 수 있습니다', '此浏览器无法在后台生成 PDF': '이 브라우저는 백그라운드에서 PDF를 만들 수 없습니다', '准备就绪': '준비 완료', '正在启动': '시작 중',
    '主菜单': '메인 메뉴',
    '合并连续音符': '연속 음표 합치기', '不合并': '합치지 않음', '低 · 同音延长': '낮음 · 같은 음높이 연장', '中 · 含元音续唱': '중간 · 이어 부르는 모음 포함', '高 · 含短装饰音': '높음 · 짧은 꾸밈음 포함', '{count} 个续唱音符并入前一字': '이어 부르는 음표 {count}개를 앞 음절에 합침',
    '感谢奥莉安多提供的样本数据和改善建议': '샘플 데이터와 개선 제안을 제공해 주신 奥莉安多 님께 감사드립니다',
    '选择或拖入工程': '프로젝트를 선택하거나 끌어 놓으세요', '不支持此文件类型。': '지원하지 않는 파일 형식입니다.', '工程中没有可转换的音符。': '변환할 음표가 없습니다.', '{format} · {count} 个声部': '{format} · 파트 {count}개', 'import.error.unsupported': '지원하지 않는 파일 형식: {name}', 'import.error.invalid': '{format} 프로젝트를 읽을 수 없습니다. {detail}',
    '识别转调': '전조 감지', '识别三连音': '셋잇단음표 감지', '转换提示': '변환 안내', '{count} 条': '{count}개', '整体': '전체', '{count} 条提示': '안내 {count}개', '在分析页查看转换提示': '분석 페이지에서 변환 안내 보기', '第 {measure} 小节转为 {key}': '{measure}마디에서 {key}(으)로 전조', '页边距 (mm)': '여백 (mm)',
    '导出 SVG': 'SVG 내보내기', '缩放': '확대/축소', '文件和设置保存在当前浏览器': '파일과 설정은 이 브라우저에 저장됩니다',
    '点击谱面文字可编辑': '악보 텍스트를 클릭하여 편집', '修改谱面文字': '악보 텍스트 편집', '保存文字': '텍스트 저장', '取消编辑': '편집 취소', '编辑 {text}': '{text} 편집', '谱面文字编辑': '악보 텍스트 편집기',
    '工作区导航': '작업 영역 탐색', '工作区栏目': '작업 영역 섹션', '工程文件': '프로젝트', '谱面设置': '악보 설정', '乐段与和声分析': '분석', '歌词与声部文字': '가사', '音高微调': '피치 조정', '展开侧栏': '사이드바 펼치기', '收起侧栏': '사이드바 접기', '关闭工作区栏目': '작업 영역 섹션 닫기', '打开工作区栏目': '작업 영역 섹션 열기', 
    'lyricEditor.title': '가사와 파트 이름', 'lyricEditor.correctTitle': '올바른 가사 붙여 넣기', 'lyricEditor.correctPlaceholder': '올바른 가사 전체를 붙여 넣으세요. 순서, 단락, 줄바꿈과 상관없이 각 파트의 음표에 자동으로 맞춥니다.', 'lyricEditor.writeAs': '쓰기', 'lyricEditor.writeText': '원문', 'lyricEditor.writeReading': '병음', 'lyricEditor.markChange': '수정 예정 {count}', 'lyricEditor.markSame': '이미 일치 {count}', 'lyricEditor.markLow': '발음 다름 {count}', 'lyricEditor.markNone': '악보에 없음 {count}', 'lyricEditor.caretNone': '“{text}”은(는) 악보에 없습니다', 'lyricEditor.caretHint': '글자에 커서를 두면 각 파트의 어느 음표에 맞는지 표시합니다.', 'lyricEditor.voiceSummary': '수정 {changed} · 일치 {matched}/{syllables}', 'lyricEditor.uncovered': '미일치 {count}:', 'lyricEditor.correctCount': '음표 {count}개 수정', 'lyricEditor.noChange': '수정할 음표 없음', 'lyricEditor.editNotes': '음표별 편집', 'lyricEditor.beats': '{beats}박', 'lyricEditor.clearAll': '이 파트 가사 지우기', 'lyricEditor.restoreAll': '지우기 전 가사 복원', 'lyricEditor.undoBatch': '마지막 바꾸기 실행 취소', 'lyricEditor.noteLyric': '{index}번째 음표 가사', 'lyricEditor.position': "{bar}마디 · {beat}박", 'lyricEditor.noVoice': '(해당 음표 없음)',
    "织音机": "직음기",
    "调号": "조표",
    "大调": "장조",
    "小调": "단조",
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
    "上一页": "이전 페이지",
    "下一页": "다음 페이지",
    "适合页面": "페이지에 맞춤",
    "第 {page} 页，共 {total} 页": "전체 {total}페이지 중 {page}페이지",
    "下载 PDF": "PDF 다운로드",
    "方向": "방향",
    "横向": "가로",
    "纵向": "세로",
    "纸张": "용지 크기",
    "适合页宽": "너비에 맞춤",
    "svp.warning.missingGroup": "{track}: 음표 그룹 {group}을(를) 찾을 수 없습니다.",
    "svp.warning.invalidNote": "{track}: 시작 위치, 길이 또는 음높이가 잘못된 음표를 건너뛰었습니다.",
    "svp.warning.invalidDetune": "{track}: 유한하지 않은 음표 미세 조정을 무시했습니다.",
    "svp.warning.pitchControls": "{track}: 피치 제어 곡선은 MusicXML로 표현할 수 없습니다.",
    "svp.warning.linearCurve": "{track}: 피치 곡선으로 음표를 조정할 때 선형 샘플링 근사값을 사용했습니다.",
    "svp.warning.representativeCurve": "{track}: 피치 곡선 모양을 음표마다 대표값 하나로 단순화했습니다.",
    "svp.warning.residual": "{track}: 음표 {count}개의 남은 센트 편차는 메타데이터로 보존하며 악보에는 표기하지 않습니다.",
    "svp.warning.swingStraight": "Swing 표기: {count}박은 고른 8분음표라 스윙으로 읽힙니다.",
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
