# Natural-use Observation Kit

这是家长主动打开、主动保存、只留在当前浏览器里的简短观察笔记，不是儿童行为监控或自动用户研究系统。工具准备完成不代表真人儿童验证、学习效果、偏好或留存已经得到证明。

## 隐私契约

```text
DEFAULT = RECORD NOTHING
MANUAL_PARENT_ACTION_ONLY = TRUE
PASSIVE_TRACKING = FALSE
ROUTE_HISTORY_CAPTURE = FALSE
SESSION_DURATION_CAPTURE = FALSE
EXACT_TIME_CAPTURE = FALSE
CAMERA = FALSE
MICROPHONE = FALSE
SCREENSHOT_CAPTURE = FALSE
CLOUD_UPLOAD = FALSE
SAVE_VAULT_EXPORT = FALSE
RETENTION_DAYS = 90
MAX_RECORDS = 100
IMPORT = NOT_IMPLEMENTED
```

- 普通玩游戏、切换页面、打开或关闭笔记、只选择表单选项，都不会创建观察记录；只有家长按下“保存这条观察”才会写入。
- surface 必须由家长从 `PLAY_SURFACE_MANIFEST` 手工选择。工具不读取或保存当前 route、访问历史、session、停留时间、点击、重玩次数或设备信息。
- 每条只保存日期 `YYYY-MM-DD`，不保存孩子使用时的小时、分钟或时区。导出文件中的 `exportedAt` 只描述家长执行导出的时间。
- optional note 最多 240 个 Unicode 字符；控制字符与换行会规范为普通空格。页面始终用纯文本显示，不执行 HTML。
- 不要在 note 写姓名、学校、班级、联系方式、健康、位置或其他私人信息。
- 每次打开、保存和导出都会清理超过 90 个本地日历日的记录；第 90 天仍保留，第 91 天删除。超过 100 条时删除最早保存的记录。
- 观察 key 是 `game-codex/parent-observation/v1`，明确不属于 `KNOWN_SAVE_KEYS`。Save Vault 不导出、不导入、也不清除它；观察笔记自己的删除也不触碰任何游戏进度。
- 导出只包含 schema-valid 的观察记录及 records SHA-256；不会读取或导出整个 localStorage、游戏存档、浏览器资料、IP、user agent、屏幕或设备信息。
- V1 不提供导入、云同步、账号、摄像头、麦克风、录屏、画像、自动评分或任何外部观察请求。

90 天和 100 条是本项目主动采用的数据最小化边界，不是对任何法律阈值的转述。设计依据在 2026-08-22 重新核验：FTC 2025 COPPA 修订要求只在具体目的合理需要的期间保留相关个人信息且不得无限期保留；ICO 儿童规范要求高隐私默认、仅收集和保留服务所需最少数据；UNICEF 最新儿童数字设计材料继续强调让儿童真实经验影响后续设计。ICO 同时提示其部分指导正因英国 Data (Use and Access) Act 的变化接受更新，因此本页只继承稳定的最小化与高隐私原则，不声称法律合规认证。

来源：

- FTC, [COPPA Final Rule Amendments](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments)
- ICO, [Age appropriate design code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/)
- ICO, [Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/8-data-minimisation/)
- UNICEF, [Children's Best Interests in Digital Policy and Practice](https://www.unicef.org/innocenti/reports/childrens-best-interests-digital-policy-and-practice)

## 家庭使用方式

1. 正常使用游戏，不需要特意观察，也不需要固定时长。
2. 偶尔注意到值得记录的现象时，打开“我的游戏世界 → 声音和画面 → 家长角 → 使用观察笔记”。
3. 用 10–20 秒记录一条，只写实际发生了什么。
4. 有一些自然出现的真实记录后，主动导出 JSON 并上传给 ChatGPT / Codex。

不需要达到固定条数，不需要每周记录，也不需要孩子完成研究任务。没有证据时不自动修改产品。

## 未来 06B 门槛

- 技术阻塞：至少一条家长观察，加上机器可复现的 bug，才成为 06B patch candidate。
- UX 摩擦：至少两条相同 surface / friction 的记录，最好来自不同日期，并且机器 reviewer 能复现或解释，才成为 candidate。
- 学习或内容重设计：一两条 anecdote 不足以触发；需要重复真实证据、领域正确性复核和机器分析。
- “主动说还想玩”或“再次选择”只作描述，不生成 engagement、fun、learning、mastery、retention 或 child-profile 分数，也不引入 push、streak、daily-login 或 FOMO。

当前终态：`Observation Kit ready / Natural-use evidence not yet collected / No scheduled human review required`。
