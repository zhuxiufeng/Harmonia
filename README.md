# Harmonia (Chrome Manifest V3 现代版)

> **Tabs? Where we're listening, we don't need tabs.**
> 专为 Google Chrome 深度重构的 **Manifest V3** 现代化高颜值 Pandora 广播电台播放器扩展。

---

## ⚖️ 免责声明 / Disclaimer

- **仅供学习与学术研究**：本项目仅供技术学习、逆向工程互操作性研究与学术交流使用（For educational and research purposes only）。
- **无官方隶属关系**：本项目为独立开发的第三方 Web 客户端，与 Pandora Media, LLC 无任何关联、赞助或背书关系。
- **版权归属**：所有商标、服务标志、歌曲与音视频版权均归其各自版权所有者所有。

---

## 🌟 项目亮点与 MV3 架构适配

由于 Chrome 逐步全面弃用 Manifest V2，原版 Anesidora 依赖的后台常驻 DOM（`background.htm`）与 `chrome.extension.getBackgroundPage()` 同步接口在 Chrome MV3 中已无法运行。

本项目完整遵循 **Chrome Manifest V3 官方规范**，在保留纯净在线广播体验的前提下，完成了现代化的跨上下文异步解耦与重构：

| 特性 / 机制 | 原版 (MV2) | 本项目 (MV3) |
| :--- | :--- | :--- |
| **Manifest 规范** | `manifest_version: 2` (已废弃) | `manifest_version: 3` (现代规范) |
| **后台宿主** | `background.htm` (常驻页面) | **Service Worker** (`sw.js`) + **Offscreen Document** (`offscreen.html`) |
| **音频流媒体播放** | Background 中的 `<audio>` 标签 | 利用 Chrome 109+ **`chrome.offscreen`** (`AUDIO_PLAYBACK` 理由) 常驻独立音频沙箱播放 |
| **跨进程通信** | `chrome.extension.getBackgroundPage()` 同步直接调用 (MV3已彻底移除) | **透明 RPC 桥接层 (`bridge.js` & `offscreen_bridge.js`)**，模拟经典对象接口，无缝兼容上层业务 |
| **网络请求头伪装** | `webRequest` 阻塞修改 (MV3限制) | 基于 **`declarativeNetRequest`** 规则，无缝将 `tuner.pandora.com` 的 `User-Agent` 伪装为 `libcurl` |
| **快捷键与操作** | `browserAction` / `_execute_browser_action` | **`action`** / **`_execute_action`** 与 Service Worker 统一路由 |
| **权限控制** | 宽泛的 URL 匹配权限 | 细粒度 `permissions: ["offscreen", "storage", "declarativeNetRequest", "commands"]` 与声明式 `host_permissions` |

---

## 🚀 功能特性

1. **Pandora 广播核心完整支持**：
   - 官方 Blowfish 加密算法解密通讯（ECB 模式）。
   - 账号登录、记忆登录状态。
   - 电台列表获取、切换电台、快速混音 (QuickMix)。
   - 搜索电台并创建新电台、删除电台。
   - 点赞 (Thumbs Up)、点踩 (Thumbs Down)、休眠歌曲 (Tired of song)、解释推荐理由 (Why is this song playing)。
2. **现代黑曜石美学与沉浸式 UI**：
   - **全新发光矢量图标**：黑曜石圆角晶透底座与珊瑚金光环双连音符。
   - **Cozy 模式**：大卡片设计，包含封面毛玻璃背景、精致导航、历史记录、电台筛选和账号面板。
   - **Compact 模式**：横条紧凑设计，占用极小视窗，适合边工作边听歌。
3. **实时歌词同步展示**：
   - 深度集成 LRCLIB 开放歌词库，自动检索并精准匹配滚动歌词。
4. **极速音频预连接与预缓冲优化**：
   - DNS Prefetch & Preconnect 预解析技术，秒级首播起播与丝滑切歌。
5. **系统级集成**：
   - **MediaSession API**：在操作系统（Windows / macOS / Linux 媒体控制中心）或 Chrome 全局媒体控制器中展示当前歌名、歌手、高清专辑封面，支持系统按键播控。
   - **Chrome 快捷键绑定**：
     - `Ctrl+Space`：呼出播放器弹窗；
     - 播放/暂停快捷键；
     - 上一首 / 下一首快捷键。
6. **高度可定制的 Options 选项页**：
   - 亮色 / 暗色 / 随系统自动切换的主题预设方案。
   - 自定义 CSS 变量调色盘与全局自定义样式输入。
   - 空闲暂停时长调节、播放历史记录上限等。

---

## 🛠️ 安装与使用教程（开发者模式）

在 Chrome 中加载本扩展极为简单，无需任何打包工具或复杂构建：

1. 打开 Google Chrome 浏览器，在地址栏输入：
   ```text
   chrome://extensions/
   ```
2. 在页面右上角开启 **「开发者模式」(Developer mode)** 开关。
3. 点击左上角的 **「加载已解压的扩展程序」(Load unpacked)** 按钮。
4. 选择本项目目录：
   ```text
   /home/zxf/workspace/code/agy/chrome_extension/anesidora-mv3
   ```
   （或使用已生成的 `anesidora_mv3_dist` 目录）。
5. 安装完成后，在 Chrome 工具栏点击 Anesidora 图标，即可登录 Pandora 账号开始聆听！

---

## 📦 打包发布

项目根目录下提供了打包脚本 `package.bash`：

```bash
cd anesidora-mv3
./package.bash
```

执行后会在上级目录生成发布文件：
- `anesidora_mv3_dist/`：纯净的分发目录。
- `anesidora_mv3.zip`：打包完毕的 Chrome Web Store 上传包。

---

## 📂 目录结构说明

```text
anesidora-mv3/
├── manifest.json            # MV3 清单配置文件
├── declarativeNetRules.json # DeclarativeNetRequest 动态规则（伪装 User-Agent）
├── offscreen.html           # MV3 离屏音频宿主页面（拥有 DOM & <audio>）
├── cozy.htm                 # Cozy 主题播放器弹窗
├── compact.htm              # Compact 紧凑模式播放器弹窗
├── options.htm              # 扩展选项与主题配置页面
├── package.bash             # 打包构建脚本
├── css/
│   ├── common.css           # 基础全局样式
│   ├── cozypopup.css        # Cozy 播放器样式
│   ├── reworked_oldpopup.css# Compact 紧凑播放器样式
│   ├── options.css          # 选项设置页面样式
│   └── *.woff2              # 离线字体资源
├── images/                  # 扩展图标、徽标与占位封面
└── js/
    ├── sw.js                # Background Service Worker（生命周期与快捷键调度）
    ├── offscreen_bridge.js  # 离屏端 RPC 网关与播放状态广播器
    ├── bridge.js            # 客户端透明桥接（为 Popup/Options 提供兼容对象）
    ├── anesidora.js         # Pandora API 核心通信层（请求/认证/电台/歌曲）
    ├── background.js        # 核心播放引擎（播放列表调度、MediaSession）
    ├── config.js            # 偏好设置、预设色彩与 Proxy 存储驱动
    ├── common.js            # 公用工具函数、主题加载与样式计算
    ├── crypt.js             # Blowfish ECB 加密实现
    ├── keys.js              # 加密密钥表
    ├── lyrics.js            # LRCLIB 实时歌词检索与解析
    ├── jscolor.js           # 选项页取色器组件
    ├── newpopup.js          # 播放器交互与界面渲染逻辑
    ├── options.js           # 选项设置与主题自定义交互逻辑
    ├── platform_specific.js # 平台特异性适配（MV3 action API）
    └── collect_errors.js    # 运行时错误收集与调试
```

---

## 🙏 致谢与参考开源项目 / Acknowledgements

本项目在架构重构与开发过程中，参考并继承了以下优秀的开源社区成果，谨在此表示衷心感谢：

1. **[Anesidora (MV2 原版)](https://github.com/pvrs12/Anesidora)**：本项目的基础原型，感谢原作者 `pvrs12` 及贡献者在经典 MV2 时代开创的精致 UI 与 Pandora 客户端实现。
2. **[Pandora JSON API Documentation](https://6xq.net/pandora-apidoc/json/)**：感谢社区整理的非官方 Pandora 逆向协议文档。
3. **[LRCLIB](https://lrclib.net/)**：提供免费、开放、高质量的歌词数据检索 API。

---

## 📄 开源许可证 / License

本项目遵循 [GNU General Public License v2.0 (GPL-2.0)](./LICENSE) 协议开源。

