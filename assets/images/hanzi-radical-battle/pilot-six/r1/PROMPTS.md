# Pilot six approved generation records

Generated using the available image_gen tool on 2026-09-05 under the explicit STEP3 authorization. The object atlas contributes only lamp, coiled vine, wheel and bowl crops. Its open vine, gate and paw-marked stones were rejected and replaced by the later independent prompts. Earlier RGB/checkerboard and magenta bridge attempts are not production sources.

## image-prompts.md

# Image generation prompts

## Canopy environment v1

```text
【ChatGPT image】
用途：Game-Codex 汉字第二章六遭遇试点的「木语树冠」正式环境底图，不是概念页。生成一张纯环境、无文字的儿童绘本森林游戏场景。
参考资产：已查看 region-glimmer-grove.webp（主风格、蓝绿月光、暖金灯光、圆润树皮与细腻柔和手绘材质）；region-echo-garden.webp（清晰大形与自然空间）。这两张仅作风格参照，不复制它们的黑色边框。
机位：固定轻俯视、平视方向可辨的三分之四游戏舞台，画面宽1000高620的构图比例，透视温和，无鱼眼，无电影虚焦。相机在森林高处的宽阔树根平台外侧，能看见树冠和远处朦胧溪谷。
构图：左右两棵温暖古树围拢，树根形成前景三处小平台：左平台中心(300,410)、中平台中心(500,300)、右平台中心(700,410)，单位基于1000×620画布。平台之间保留细窄可跨越的幽蓝树冠缝隙，让之后独立桥段可在它们之间搭接。中心上半部有柔和树叶与月光深景，远处一点萤火；不能出现绘制好的完整桥、门、树藤障碍、人物或发光文字。三处平台顶面朴素干净，给程序化字碑和脚印留下空间。
状态：只制作始终不移动的环境底层；所有交互桥段、灯苗、藤蔓和叶门会另行叠加。场景内不提前完成任何修复。
保留区：画面中间60%必须同时包含三处平台，移动端中心裁切仍可看到它们。上方中央15%保留不杂乱的环境，不画UI。前景底部保留柔软暗叶边缘，不能形成画框。
光色：童话绘本的深青蓝夜色、柔和绿色树冠；左上温金月灯与右上浅蓝环境光，明暗层次清楚。可见木纹、苔藓、轻微笔触，高质量细节但可在手机读懂。
透明/尺寸：环境底图不需要透明，1536×960横幅，画面必须满幅无黑框、白边或留白；会派生运行WebP。
禁止：任何汉字、拼音、字母、数字、按钮、图标、箭头、标签、对话框、水印、签名；不要3D塑料、低多边形、几何色块、写实照片、压迫悬崖、恐怖表情、过密光点、完整已修复桥、六宫格、状态对比拼图。
```


## inkleaves-prompt.md

```text
【ChatGPT image】
用途：儿童汉字森林游戏的可交互前景遮挡物，指光照出通路之前覆盖桥口的墨叶，一组独立物体。参考现有Theme C木语树冠：柔软绘本、水彩厚涂、深蓝森林、青绿反光、温暖月光，不含任何角色。
机位与构图：近正面稍俯视约15度，横向3:2画幅，中央一簇六到八片宽大卷曲树叶，叶缘如墨水微微卷起；呈拱形、下方横向占宽，整簇宽约画幅70%、高约55%，四周至少12%空白，各叶轮廓清楚，无地面。
状态：before，静止的墨蓝紫叶片遮住道路，但并不恐怖、无脸、无眼睛、无文字。之后由程序移动/淡出这同一簇叶片，不另造after全景。
光色：上左柔和暖光，右侧冷青色反光，叶脉有柔和蓝色高光；有手绘纸感，不能成为硬质石块或粗糙几何块。
背景与尺寸：1536×1024左右，纯品红RGB255,0,255抠像底色，完全均匀；叶片所有空隙也品红。物体不可有品红颜色或粉色边。无背景阴影、地板、渐变、棋盘格。最终程序将校验抠像后的真实alpha，不画透明示意。
禁止：文字、汉字、拼音、数字、符号、按钮、标签、水印、背景环境、整张场景、桥、重复状态、发光粒子散满画面。
```


## bridge-new-prompt.md

```text
【ChatGPT image】
Generate ONE brand-new isolated wooden rope bridge game sprite with a genuinely transparent background (RGBA alpha channel). This is an object asset, never a whole scene or a mock transparency grid. Do not draw any background color, checkerboard, shadow plane or atmospheric halo.
用途：Theme C绘本森林中、两个字碑之间由规则接通的一段可走木藤桥。柔和手绘森林风格，近正面、轻微15度俯视，温暖蜂蜜棕木板、青绿藤绳和少量柔软苔叶，上左金暖光、右侧青冷反光。完整宽而平坦的水平桥面，左右两端同高度；桥栏低矮，不能挡文字节点。桥面约16块木板、两侧藤绳扶手，各部件有合理连接。可看清桥面可走，不能是粗糙色块。
构图：宽画幅2:1，物体居中、宽度80%且高度约35%，四周干净透明安全区；左右端完整。尺寸约1536×768。状态只有接好的after桥段；before由游戏显示断开通路，没有桥，不另画全景。
文字、数字、汉字、拼音、按钮、角色、标志、标签、水印、背景风景全部禁止。输出真实透明PNG，尤其绳间和桥下全部透明，绝不把白灰棋盘格画进像素。
```


## remaining-art-prompts.md

## 清泉石谷环境
```text
【ChatGPT image】
用途：Game-Codex汉字第二章“清泉石谷”的唯一固定环境底图，用于路/进两段可交互对象，不含完成态道路或水轮。全幅环境可以是不透明RGB，绝不把UI或汉字烘焙进图片。
风格基准：已采用的Theme C木语树冠是柔和绘本森林、厚涂水彩质感、青蓝空气透视、温暖金色灯光点缀。这里仍是同一森林，但从树冠来到有清浅溪流的石谷；仍有苔树根、圆润石台、清澈溪水和远处柔雾，不是写实摄影或3D塑料。
固定机位：近正面略俯视15度，16:10宽幅，眼平线在上方约25%，河谷从前方低处延伸到远处中间。左右各一块可停小物体的宽石台，其上表面中心分别位于画宽约25%/75%、画高约60%；中间后方有第三块小石台，中心约50%/40%。三台之间有清楚的溪流缺口，不能预先画完连通石路。
构图保留区：中央20%-80%宽、30%-80%高是以后放置路点/水轮/文字节点的操作区，石台表面空净、无细碎大物。左右边缘可有苔树枝和蕨叶来框景；顶部远景淡青留气口，底部水面深蓝较平静。主操作区光比适中，暖金光在左上、青冷反光在右侧，不能强烈逆光或眩光。
状态：仅一张固定before环境，不画不同状态对比、不画分屏/拼图。图层中的局部路面和小水轮另由独立对象生成，必须不出现在这张底图。无角色、无Boss、无灯苗、无桥、无水轮、无任何可点按钮。
尺寸约1600×1000。完整铺满画面、不加边框或白边。禁止文字、汉字、拼音、数字、标志、水印、箭头、符号、UI、拍照景深造成主要石台模糊、紫黑恐怖氛围或危险瀑布。
```

## 独立对象图集
```text
【ChatGPT image】
Generate a high quality GAME OBJECT SPRITE SHEET on genuinely TRANSPARENT RGBA background, exactly 2 columns × 4 rows, seven isolated objects and one empty cell. This is a production atlas for later source-native cropping, NOT a scene, not labelled diagrams. Never draw a checkerboard, colored matte, ground plane, atmospheric glow outside the objects, or text.
用途：同一款儿童绘本森林游戏中，灯苗、两态树藤、叶门、踏石、小水轮与吃饱后的空碗。与Theme C木语树冠一致：柔和水彩厚涂森林、细腻纸感、上左柔暖金光、右侧淡青反光、自然苔绿色与蜂蜜木棕。所有对象用同一略俯视15度、近正面机位，轮廓完整，不能塑料质感或粗糙色块。
画布：透明底约2048×2048或更高；精确均匀2列4行。每个单元有独立居中物体，四边至少12%真正透明留白；物体彼此不能相碰，叶尖和绳索都不能越过格边。每格无画框、无线条、不显示格子本身。各物体细节足够在单独导出后显示为约200CSS像素。
第一行左：一株疲倦的灯苗，单根柔弯茎、两片长叶、顶部一颗闭合的浅金灯苞，生于很小的圆苔根团。灯苞暗淡不发光，整体略垂，但清楚仍是植物灯苗，无脸无眼睛。后续程序在同一对象上增加柔光，不能画旁边的第二状态。
第一行右：一根纠结但不恐怖的粗软藤，弯成一圈松松的卷结，带少量小叶，左右短尾完整；深苔绿表面有暖金纤维。它是closed树藤。要保留可对应的三片主要小叶与一对分叉尖端。
第二行左：与上一格同一根藤的舒展状态，保持相同材质、厚度、三片主要小叶、分叉尖端与照明；展开为可承托通路的长弧，横向宽而低，左右两端同高度、中央柔弯。不能画木板桥，不画新藤或乱加装饰。这是open状态。
第二行右：一扇愿意回应的双叶门，两个对称大叶扇沿中间竖缝闭合，深绿柔叶、金褐细藤外框，左右明显藤铰链；门整体圆润矮拱，近正面。左右门扇必须分别位于格内中心竖线两侧，中心缝清楚；后续程序会把这同一图切成左右半扇开合。不要门后的风景或地面。
第三行左：一段水平的浅溪踏石道路，由约6块圆润扁平石块组成，边缘少量苔；左右两端同高度、桥状横排，俯视能见可落脚顶面。石块之间只留很细的透空缝，不包含河水、岸边、草地或背景。冷灰青石面有温暖金色的小脚印，不能出现文字、箭头或数字。
第三行右：一只独立、可被带着移动的小型木质水轮，8个辐条，中心圆轴，轮缘有合理的舀水木叶/斗；整体完整圆形，略俯视近正面，能看到轮宽和轴头，色彩蜂蜜棕木与青绿苔。一只小轮，没有支架、底座、大坝、溪流、道路、角色或箭头，不预先表示整座水轮修复。
第四行左：一只吃完饭后放下的空木碗和一把短木勺，木碗内清楚为空，勺安静搭在碗边；同样近正面略俯视，温暖干净，不含食物包装、品牌或其他物体。
第四行右：完全透明空单元。
严禁：任何文字、汉字、拼音、数字、标签、水印、按钮、角色、表情、整幅环境、状态对比标题、checkerboard或模拟透明底。每件对象四周与所有孔洞必须是真实alpha透明。
```


## stone-path-prompt.md

```text
【ChatGPT image】
Production game object for the children's illustrated forest "清泉石谷": one isolated horizontal stepping-stone path, five rounded flat slate stones nearly touching in a gently level row, moss on outer edges only. Genuine transparent RGBA background and transparent gaps. No colored matte, no background, no checkerboard, no glow outside silhouette.
Purpose: runtime object layer that appears only after two legal character stones are connected, while a separate small waterwheel later travels along it. Follow Theme C gentle painterly storybook forest, honey warm illumination from upper left, cool teal reflections from right. Near frontal camera tilted down 15 degrees so stepping surfaces are visible; path left and right ends same height, horizontal orientation. Whole shape fits the central 85% width and 60% height with at least 10% clear alpha border on every edge. About 1200 x 600 canvas.
The top faces must be plain clean cool gray blue stone, absolutely no animal paw prints or human footprints, no letters, Chinese, pinyin, arrows, digits, logos, symbols, faces, food, ground, water, riverbank, vegetation beyond tiny edge moss, bridge timber, people, frame or UI. All holes and every exterior pixel outside the object have real alpha transparency. Render only this single object, not alternate states or a sprite sheet.
```


## isolated-object-prompts.md

```text
【ChatGPT image】
Generate ONE isolated transparent RGBA game sprite: a gracefully unfurled living vine, broad horizontal U curve with both ends at equal height and center bowing down, three main small green leaves and forked twig tips, complete silhouette. No other objects. Purpose: same soft moss-green vine used as a traversable path in a children's Theme C storybook forest. Warm golden fibers around a dark moss-green soft vine trunk, delicate painterly watercolor paper texture, honey light from upper left, cool teal reflection from right. Near frontal camera looking down about 15 degrees; long thin 3:1 object centered in a 1200x600 transparent canvas; every leaf and twig has 10% real transparent padding around canvas edges. No glow beyond silhouette. No ground, background, checkerboard, text, symbols, numbers, labels, watermarks, bridge wood, scary faces or frame. This is the open state of a formerly loosely coiled vine; keep natural pliant thickness and few quiet leaves, not dense foliage. Every hole and exterior must be true alpha transparency.
```

```text
【ChatGPT image】
Generate ONE isolated transparent RGBA game sprite: a closed friendly forest double leaf gate. Two broad symmetrical green leaf door panels meet at a clear vertical center seam, within a warm honey-brown vine frame forming a short rounded arch. Clearly visible little vine hinges on left and right. A few modest moss tufts integrated with the frame. No floor or ground. Soft painterly watercolor storybook Theme C forest material, warm golden light from upper left, gentle teal reflection from right, near frontal camera looking down 15 degrees. Purpose: interactive child game object; the SAME two leaf panels are separated by program to open, so left and right halves should balance and be intact. Whole gate centered, occupying 80% of a 800x900 canvas, at least 10% entirely clear alpha border on every edge. Door dark green with delicate gold leaf veins, natural matte texture, no plastic or metallic sheen. No other objects, scene, background, glow outside silhouette, checkerboard, letters, Chinese text, pinyin, digits, labels, arrows, facial features, logos or frames. All exterior pixels and frame holes have genuine alpha transparency.
```
