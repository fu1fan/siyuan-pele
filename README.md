# Pele for SiYuan

用 [Pele](https://github.com/obsidianmd/pele) 绘制思源的 Mermaid 块。继续用思源原有的代码块编辑器编写 Mermaid。插件只接管显示，能随思源主题和容器宽度更新。默认保留源码方向。大图支持 Pele 的缩放控件，双击图面可打开大图，按 Esc 关闭。

## 安装

从 [Releases](https://github.com/fu1fan/siyuan-pele/releases) 下载 `package.zip`，解压至工作空间的 `data/plugins/siyuan-pele/`，确认该目录直接包含 `plugin.json` 和 `index.js`。重新加载思源，在插件设置中启用 Pele for Mermaid。

## 兼容性

针对思源 3.8.12 编辑器的 Mermaid 块结构。使用完整 Pele 1.13.0，内置图表类型、源码指令和布局选项由该版本解析。插件启用了图表链接和图片。SVG 在挂载前经过思源提供的 DOMPurify。图表元素可通过上游的 `--pele-*` CSS 变量调整。插件随安装包携带渲染引擎，可离线绘图；外部图片仍依赖其来源。

编辑器请求绘图时优先调用 Pele，解析失败交还原生 Mermaid。启用前已经显示的图也会尝试挂载 Pele。使用 `logos:` 图标时按需读取思源自带图标包。宿主已加载同步 MathJax SVG 接口时，插件会将其接入 Pele 的公式排版。思源独立导出页面使用自己的渲染流程。

## 开发

需要 Node.js 20+、npm 和 zip。在项目根目录运行：

```sh
npm ci
npm run build
```

构建生成 `dist/` 和可安装的 `package.zip`。插件及 Pele 均采用 MIT 许可证。
