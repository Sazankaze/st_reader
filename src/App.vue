<template>
  <div :class="['st-reader', { 'dark-mode': isDarkMode }]">
    <div v-if="!messages.length" class="upload-area">
      <div class="upload-container">
        <input type="file" ref="fileInput" @change="handleFileUpload" accept=".jsonl" id="file-input"
          class="file-input" />
        <label for="file-input" class="upload-label">
          <div class="upload-text">选择 JSONL 文件</div>
          <div class="upload-hint">SillyTavern 导出的聊天记录</div>
        </label>
      </div>
    </div>

    <div v-else class="chat-container">
      <div class="chat-header">
        <div class="header-content">
          <h1 class="chat-title">{{ metadata.character_name || '聊天记录' }}</h1>
          <div class="chat-meta">
            <span v-if="metadata.create_date">{{ metadata.create_date }}</span>
            <span class="message-count">{{ messages.length }} 条消息</span>
          </div>
        </div>
        <div class="header-actions">
          <button @click="toggleSearchBar" :class="['action-button', 'search-toggle', { 'active': showSearchBar }]">
            搜索
          </button>
          <button @click="toggleTagFilterManager" :class="['action-button', { 'active': showTagFilterManager }]">
            标签过滤 <span v-if="tagFilters.length">({{tagFilters.filter(f => !f.disabled).length}})</span>
          </button>
          <button @click="toggleRegexManager" class="action-button regex-button">
            正则脚本 <span v-if="regexScripts.length">({{regexScripts.filter(s => !s.disabled).length}})</span>
          </button>
          <div class="header-actions">
            <button @click="toggleFavoritesPanel" :class="['action-button', { 'active': showFavoritesPanel }]">
              收藏夹 <span v-if="favorites.length">({{ favorites.length }})</span>
            </button>
            <button @click="openIntimacyModal" class="action-button intimacy-btn">
              <Icon icon="bxs:heart" class="heart-icon" /> 亲密度
            </button>
            <button @click="toggleReadingMode"
              :class="['action-button', 'reading-mode-btn', { 'active': readingMode }]">
              阅读模式
            </button>
            <button @click="openExportRangeDialog" class="action-button">
              导出
            </button>
          </div>
          <button @click="toggleStylePanel" :class="['action-button', { 'active': showStylePanel }]">
            样式
          </button>
          <button @click="toggleDarkMode" class="action-button mode-toggle">
            <div class="icon-label-row">
              <template v-if="isDarkMode">
                <Icon icon="heroicons-solid:sun" class="mode-icon sun" />
                <span>日间</span>
              </template>

              <template v-else>
                <Icon icon="bxs:moon" class="mode-icon moon" />
                <span>夜间</span>
              </template>
            </div>
          </button>
          <button @click="resetReader" class="reset-button">重新加载</button>
        </div>
      </div>

      <div v-if="showSearchBar" class="search-bar">
        <div class="search-input-wrapper">
          <input v-model="searchQuery" @input="onSearchInput" type="text" class="search-input"
            placeholder="搜索消息内容或发言者..." />
          <button v-if="searchQuery" @click="clearSearch" class="search-clear" title="清除">✕</button>
        </div>
        <div class="search-info">
          <span v-if="searchQuery">
            找到 {{ filteredMessages.length }} 条匹配
          </span>
        </div>
      </div>

      <div v-if="showTagFilterManager" class="regex-manager tag-filter-manager">
        <div class="regex-header">
          <h2>标签过滤（优先于正则）</h2>
          <div class="regex-actions">
            <button @click="addNewTagFilter" class="btn btn-primary">添加过滤</button>
          </div>
        </div>

        <div v-if="tagFilterForm.id" class="script-form">
          <div class="form-group">
            <label>过滤器名称</label>
            <input v-model="tagFilterForm.name" type="text" placeholder="如：移除思维链" />
          </div>
          <div class="form-group">
            <label>标签名（不含尖括号）</label>
            <input v-model="tagFilterForm.tagName" type="text" placeholder="如：think 或 thinking" />
            <div class="form-hint">支持多个标签，用逗号分隔，如：think,thinking,disclaimer</div>
          </div>
          <div class="form-group">
            <label>过滤模式</label>
            <select v-model="tagFilterForm.mode" class="form-select">
              <option value="remove">删除这些标签及其内容</option>
              <option value="keep">只保留这些标签内的内容</option>
              <option value="unwrap">移除标签但保留内容</option>
            </select>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input v-model="tagFilterForm.disabled" type="checkbox" />
              禁用此过滤器
            </label>
          </div>
          <div class="form-buttons">
            <button @click="cancelEditTagFilter" class="btn btn-secondary">取消</button>
            <button @click="saveTagFilter" class="btn btn-primary">保存</button>
          </div>
        </div>

        <div class="script-list">
          <div v-if="!tagFilters.length" class="no-scripts">
            暂无标签过滤器，点击"添加过滤"来创建
          </div>
          <div v-for="(filter, index) in tagFilters" :key="filter.id"
            :class="['script-item', { 'disabled': filter.disabled }]">
            <div class="script-info">
              <div class="script-name">{{ filter.name }}</div>
              <div class="script-regex">
                {{ filter.mode === 'remove' ? '删除' : filter.mode === 'keep' ? '只保留' : '解包' }}:
                &lt;{{ filter.tagName }}&gt;
              </div>
            </div>
            <div class="script-controls">
              <button @click="moveTagFilterUp(index)" :disabled="index === 0" class="btn-icon" title="上移">↑</button>
              <button @click="moveTagFilterDown(index)" :disabled="index === tagFilters.length - 1" class="btn-icon"
                title="下移">↓</button>
              <button @click="toggleTagFilter(filter)" :class="['btn-toggle', { 'active': !filter.disabled }]">
                {{ filter.disabled ? '已禁用' : '已启用' }}
              </button>
              <button @click="editTagFilter(filter)" class="btn-icon" title="编辑">✎</button>
              <button @click="deleteTagFilter(filter.id)" class="btn-icon btn-danger" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showRegexManager" class="regex-manager">
        <div class="regex-header">
          <h2>正则脚本管理</h2>
          <div class="regex-actions">
            <button @click="importScripts" class="btn btn-secondary">导入JSON</button>
            <button @click="importFromPNG" class="btn btn-secondary">从角色卡导入</button>
            <button @click="exportScripts" class="btn btn-secondary" :disabled="!regexScripts.length">导出</button>
            <button @click="addNewScript" class="btn btn-primary">添加脚本</button>
          </div>
        </div>

        <div v-if="scriptForm.id" class="script-form">
          <div class="form-group">
            <label>脚本名称</label>
            <input v-model="scriptForm.scriptName" type="text" placeholder="如：移除思维链内容" />
          </div>
          <div class="form-group">
            <label>正则表达式</label>
            <textarea v-model="scriptForm.findRegex" placeholder="如：/(<think>[\s\S]*?</think>)/gs" rows="3"></textarea>
            <div class="form-hint">支持格式：/pattern/flags 或直接输入模式（默认添加 g 标志）</div>
          </div>
          <div class="form-group">
            <label>替换内容</label>
            <input v-model="scriptForm.replaceString" type="text" placeholder="留空表示删除匹配内容" />
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input v-model="scriptForm.disabled" type="checkbox" />
              禁用此脚本
            </label>
          </div>
          <div class="form-buttons">
            <button @click="cancelEdit" class="btn btn-secondary">取消</button>
            <button @click="saveScript" class="btn btn-primary">保存</button>
          </div>
        </div>

        <div class="script-list">
          <div v-if="!regexScripts.length" class="no-scripts">
            暂无正则脚本，点击"添加脚本"或"导入"来创建
          </div>
          <div v-for="(script, index) in regexScripts" :key="script.id"
            :class="['script-item', { 'disabled': script.disabled, 'dragging': dragIndex === index }]" draggable="true"
            @dragstart="handleDragStart(index)" @dragover="handleDragOver" @drop="(e) => handleDrop(e, index)"
            @dragend="handleDragEnd">
            <div class="script-drag-handle">⋮⋮</div>
            <div class="script-info">
              <div class="script-name">{{ script.scriptName }}</div>
              <div class="script-regex">{{ script.findRegex.substring(0, 60) }}{{ script.findRegex.length > 60 ? '...' :
                '' }}
              </div>
            </div>
            <div class="script-controls">
              <button @click="moveScriptUp(index)" :disabled="index === 0" class="btn-icon" title="上移">↑</button>
              <button @click="moveScriptDown(index)" :disabled="index === regexScripts.length - 1" class="btn-icon"
                title="下移">↓</button>
              <button @click="toggleScript(script)" :class="['btn-toggle', { 'active': !script.disabled }]">
                {{ script.disabled ? '已禁用' : '已启用' }}
              </button>
              <button @click="editScript(script)" class="btn-icon" title="编辑">✎</button>
              <button @click="deleteScript(script.id)" class="btn-icon btn-danger" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showFavoritesPanel" class="regex-manager favorites-panel">
        <div class="regex-header">
          <h2>收藏夹</h2>
          <div class="regex-actions">
            <button @click="exportFavorites" class="btn btn-secondary" :disabled="!favorites.length">导出</button>
            <button @click="clearAllFavorites" class="btn btn-secondary" :disabled="!favorites.length">清空</button>
          </div>
        </div>
        <div class="script-list favorites-list">
          <div v-if="!favorites.length" class="no-scripts">
            暂无收藏，点击消息右上角的 ☆ 收藏整条消息，或选中文字后点击"收藏"
          </div>
          <div v-for="fav in favorites" :key="fav.id" class="favorite-item" @click="navigateToFavorite(fav)"
            title="点击跳转到对应楼层">
            <div class="favorite-content">
              <div class="favorite-type">
                <template v-if="fav.type === 'message'">
                  <Icon icon="icon-park-twotone:copy" style="vertical-align: -2px;" /> 楼层
                </template>
                <template v-else>
                  <Icon icon="ri:draft-line" style="vertical-align: -2px;" /> 句子
                </template>
                #{{ fav.messageIndex + 1 }}
              </div>
              <div class="favorite-text">{{ fav.text.substring(0, 100) }}{{ fav.text.length > 100 ? '...' : '' }}</div>
              <div class="favorite-meta">
                <span v-if="fav.speaker">{{ fav.speaker }}</span>
                <span>{{ formatFavoriteTime(fav.createdAt) }}</span>
              </div>
            </div>
            <div class="favorite-actions">
              <button @click.stop="copyFavorite(fav)" class="btn-icon" title="复制">
                <Icon icon="icon-park-twotone:copy" style="vertical-align: -2px;" />
              </button>
              <button @click.stop="deleteFavorite(fav.id)" class="btn-icon btn-danger" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showStylePanel" class="regex-manager style-panel">
        <div class="regex-header">
          <h2>正文样式设置</h2>
          <div class="regex-actions">
            <button @click="resetStyles" class="btn btn-secondary">恢复默认</button>
          </div>
        </div>

        <div class="style-settings">
          <div class="style-group font-group">
            <label class="style-label">字体设置</label>
            <div class="style-flex-row">
              <select v-model="textStyles.fontFamily" @change="saveStylesToStorage" class="style-select">
                <optgroup label="系统字体">
                  <option value="system">系统默认</option>
                  <option value="serif">宋体 / 衬线体</option>
                  <option value="sans-serif">黑体 / 无衬线体</option>
                  <option value="kaiti">楷体</option>
                  <option value="fangsong">仿宋</option>
                  <option value="monospace">等宽字体</option>
                </optgroup>
                <optgroup label="在线字体">
                  <option value="alegreya">Alegreya</option>
                  <option value="cangeryunhei">仓耳云黑</option>
                  <option value="huiwenmingchao">汇文明朝</option>
                  <option value="kongmingchao">空明朝（繁体/日文）</option>
                  <option value="pingxianzhensong">屏显臻宋</option>
                  <option value="wenyueminguofangsong">文悦民国仿宋</option>
                </optgroup>
                <optgroup v-if="customFonts.length" label="自定义字体">
                  <option v-for="font in customFonts" :key="font.id" :value="'custom-' + font.id">
                    {{ font.name }}
                  </option>
                </optgroup>
              </select>
              <button @click="showCustomFontDialog = true" class="btn btn-secondary btn-sm compact-btn" title="导入字体">
                + 导入
              </button>
            </div>
          </div>

          <div class="sliders-grid">
            <div class="style-group compact-group">
              <label class="style-label">字号 / {{ textStyles.fontSize }}px</label>
              <input type="range" v-model.number="textStyles.fontSize" @input="handleStyleChange" min="12" max="32"
                step="1" class="style-slider" />
            </div>

            <div class="style-group compact-group">
              <label class="style-label">行高 / {{ textStyles.lineHeight.toFixed(1) }}</label>
              <input type="range" v-model.number="textStyles.lineHeight" @input="handleStyleChange" min="1.2" max="3"
                step="0.1" class="style-slider" />
            </div>

            <div class="style-group compact-group">
              <label class="style-label">段距 / {{ textStyles.paragraphSpacing.toFixed(1) }}em</label>
              <input type="range" v-model.number="textStyles.paragraphSpacing" @input="handleStyleChange" min="0"
                max="2" step="0.1" class="style-slider" />
            </div>

            <div class="style-group compact-group">
              <label class="style-label">字距 / {{ textStyles.letterSpacing }}px</label>
              <input type="range" v-model.number="textStyles.letterSpacing" @input="handleStyleChange" min="-2" max="10"
                step="0.5" class="style-slider" />
            </div>
          </div>

          <hr class="style-divider">

          <div class="color-grid">
            <div class="style-group compact-group">
              <label class="style-label">主要文本</label>
              <div class="color-picker-row">
                <input type="color" v-model="textStyles.textColor" @change="saveStylesToStorage" class="color-input">
                <span class="color-value">{{ textStyles.textColor }}</span>
              </div>
            </div>

            <div class="style-group compact-group">
              <label class="style-label">斜体 (*text*)</label>
              <div class="color-picker-row">
                <input type="color" v-model="textStyles.italicColor" @change="saveStylesToStorage" class="color-input">
                <span class="color-value">{{ textStyles.italicColor }}</span>
              </div>
            </div>

            <div class="style-group compact-group">
              <label class="style-label">下划线 (&lt;u&gt;)</label>
              <div class="color-picker-row">
                <input type="color" v-model="textStyles.underlineColor" @change="saveStylesToStorage"
                  class="color-input">
                <span class="color-value">{{ textStyles.underlineColor }}</span>
              </div>
            </div>

            <div class="style-group compact-group">
              <label class="style-label">引用 ( > )</label>
              <div class="color-picker-row">
                <input type="color" v-model="textStyles.quoteColor" @change="saveStylesToStorage" class="color-input">
                <span class="color-value">{{ textStyles.quoteColor }}</span>
              </div>
            </div>
          </div>

          <hr class="style-divider">

          <div class="style-group">
            <label class="style-label">对齐方式</label>
            <div class="align-options">
              <button @click="setTextAlign('left')"
                :class="['align-btn', { 'active': textStyles.textAlign === 'left' }]" title="左对齐">◧</button>
              <button @click="setTextAlign('justify')"
                :class="['align-btn', { 'active': textStyles.textAlign === 'justify' }]" title="两端对齐">▣</button>
              <button @click="setTextAlign('center')"
                :class="['align-btn', { 'active': textStyles.textAlign === 'center' }]" title="居中">◫</button>
            </div>
          </div>
        </div>

        <div class="style-preview">
          <div class="style-preview-label">预览效果：</div>
          <div class="style-preview-content" :style="getPreviewStyles()">
            <p>
              这是一段主要文本。通常用于描写环境、动作或是正常的对话内容。你可以通过这段文字来确认基础字色是否符合你的阅读习惯。
            </p>

            <p>
              <em>*这是一段斜体文本。在很多场景下，它被用来表现角色的内心独白、潜意识的想法，或者仅仅是为了表示某种特殊的强调语气。*</em>
            </p>

            <p>
              接着是特殊的标记内容，请注意这里有一段 <u>下划线文本</u>。这种格式常用于信件中的重点、告示牌上的文字，或者特殊的线索提示。
            </p>

            <blockquote>
              “这是一段引用文本。<br>
              它通常用于展示书信内容、回忆的片段、书籍摘录或者是诗歌。<br>
              请检查这段文字的颜色以及左侧引用线的颜色是否清晰。”
            </blockquote>
          </div>
        </div>

        <div v-if="customFonts.length" class="custom-fonts-section">
          <div class="style-label">已导入的自定义字体</div>
          <div class="custom-font-list">
            <div v-for="font in customFonts" :key="font.id" class="custom-font-item">
              <span class="custom-font-name">{{ font.name }}</span>
              <button @click="deleteCustomFont(font.id)" class="btn-icon btn-danger" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义字体导入对话框 -->
      <div v-if="showCustomFontDialog" class="modal-overlay" @click.self="showCustomFontDialog = false">
        <div class="modal-dialog custom-font-dialog">
          <div class="modal-header">
            <h3>导入自定义字体</h3>
            <button @click="showCustomFontDialog = false" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>字体名称 <span class="required">*</span></label>
              <input v-model="customFontForm.name" type="text" placeholder="给字体起个名字" class="form-input" />
            </div>

            <div class="import-tabs">
              <div class="import-method">
                <div class="import-method-header">方式一：从URL导入</div>
                <input v-model="customFontForm.url" type="text" placeholder="输入字体文件的URL（支持 ttf/otf/woff/woff2）"
                  class="form-input" :disabled="!!customFontForm.file" />
              </div>

              <div class="import-divider">或</div>

              <div class="import-method">
                <div class="import-method-header">方式二：从文件导入</div>
                <input ref="fontFileInput" type="file" accept=".ttf,.otf,.woff,.woff2" @change="handleFontFileSelect"
                  class="form-file-input" :disabled="!!customFontForm.url" />
                <div v-if="customFontForm.file" class="file-selected">
                  已选择: {{ customFontForm.file.name }}
                </div>
              </div>
            </div>

            <div class="form-hint">
              支持的格式：TTF、OTF、WOFF、WOFF2<br>
              注意：通过文件导入的字体会转换为Base64存储在浏览器中
            </div>
          </div>
          <div class="modal-footer">
            <button @click="resetCustomFontForm" class="btn btn-secondary">清空</button>
            <button @click="addCustomFont" class="btn btn-primary">导入字体</button>
          </div>
        </div>
      </div>

      <div v-if="highlightMenu.show" class="highlight-menu"
        :style="{ left: highlightMenu.x + 'px', top: highlightMenu.y + 'px' }">
        <button @click="removeHighlightFromMenu" class="selection-btn">✕ 取消划线</button>
      </div>

      <div v-if="!readingMode" class="messages-wrapper" :style="getContentStyles()">
        <div v-for="(message, index) in paginatedMessages" :key="currentRange.start + index"
          :class="['message-block', { 'user-message': message.is_user }]">
          <div class="message-header">
            <span class="speaker-name">{{ message.name }}</span>
            <div class="message-info">
              <span v-if="message.send_date" class="timestamp">{{ message.send_date }}</span>
              <span v-if="message.model" class="model-tag">{{ message.model }}</span>
              <button @click="toggleFavoriteMessage(getGlobalMessageIndex(index), message)"
                :class="['edit-btn', { 'favorited': isMessageFavorited(getGlobalMessageIndex(index)) }]"
                :title="isMessageFavorited(getGlobalMessageIndex(index)) ? '取消收藏' : '收藏楼层'">
                {{ isMessageFavorited(getGlobalMessageIndex(index)) ? '★' : '☆' }}
              </button>
              <button @click="toggleEditMessage(getGlobalMessageIndex(index))" class="edit-btn"
                :title="editingMessageIndex === getGlobalMessageIndex(index) ? '取消编辑' : '编辑消息'">
                {{ editingMessageIndex === getGlobalMessageIndex(index) ? '✕' : '✎' }}
              </button>
            </div>
          </div>

          <div v-if="editingMessageIndex === getGlobalMessageIndex(index)" class="message-edit-form">
            <textarea v-model="editingContent" class="edit-textarea" rows="10"></textarea>
            <div class="edit-actions">
              <button @click="cancelEditMessage" class="btn btn-secondary">取消</button>
              <button @click="saveEditMessage" class="btn btn-primary">保存</button>
            </div>
          </div>

          <template v-if="editingMessageIndex !== getGlobalMessageIndex(index)">
            <div v-if="hasHTMLCodeBlock(getMessageContent(message))" class="message-content-mixed"
              :style="getContentStyles()" @mouseup="handleTextSelection($event, getGlobalMessageIndex(index), message)">
              <div class="message-content" :style="getContentStyles()"
                v-html="renderContentWithHTMLPlaceholder(getMessageContent(message), getGlobalMessageIndex(index))">
              </div>
            </div>
            <div v-else-if="isFullHTML(getMessageContent(message))" class="message-content-html">
              <div class="html-preview-header">
                <span class="html-tag">HTML 文档</span>
                <button @click="toggleHTMLPreview(getGlobalMessageIndex(index))" class="preview-toggle">
                  {{ message.showPreview ? '隐藏预览' : '显示预览' }}
                </button>
              </div>
              <iframe v-if="message.showPreview" :srcdoc="getMessageContent(message)" class="html-iframe"
                sandbox="allow-scripts allow-same-origin"></iframe>
              <pre v-else class="html-code">{{ getMessageContent(message) }}</pre>
            </div>
            <div v-else class="message-content" :style="getContentStyles()"
              v-html="renderContent(getMessageContent(message), getGlobalMessageIndex(index))"
              @mouseup="handleTextSelection($event, getGlobalMessageIndex(index), message)"></div>
          </template>

          <div v-if="message.swipes && message.swipes.length > 1" class="swipe-controls">
            <button @click="prevSwipe(getGlobalMessageIndex(index))" :disabled="message.currentSwipeIndex === 0"
              class="swipe-btn" title="上一条">
              ◀
            </button>
            <span class="swipe-indicator">
              {{ message.currentSwipeIndex + 1 }} / {{ message.swipes.length }}
            </span>
            <button @click="nextSwipe(getGlobalMessageIndex(index))"
              :disabled="message.currentSwipeIndex === message.swipes.length - 1" class="swipe-btn" title="下一条">
              ▶
            </button>
          </div>
        </div>
      </div>

      <div v-if="readingMode" class="reading-view" ref="readingView" @click="handleReadingClick">
        <div class="reading-content" ref="readingContentEl" :style="getReadingTransform()" v-html="readingFullHtml"
          @mouseup="onReadingMouseUp" @touchstart="onReadingTouchStart" @touchend="onReadingTouchEnd"></div>

        <!-- 左右两侧的翻页热区 -->
        <div class="reading-nav-left" @click="readingPrevPage"></div>
        <div class="reading-nav-right" @click="readingNextPage"></div>
        <div class="reading-nav-center" @click="toggleToolbar"></div>

        <div :class="['reading-footer', { 'visible': toolbarVisible }]">
          <div class="reading-progress">
            <span>{{ readingCurrentPage }} / {{ readingTotalPages }} 页</span>
            <span class="reading-floor">楼层 {{ getReadingFloorRange() }}</span>
          </div>

          <div class="reading-controls">
            <button @click="readingPrevPage" :disabled="readingCurrentPage <= 1" class="reading-btn">◀</button>
            <button @click="toggleReadingMode" class="reading-btn reading-exit">退出</button>
            <button @click="readingNextPage" :disabled="readingCurrentPage >= readingTotalPages"
              class="reading-btn">▶</button>
          </div>
        </div>
      </div>

      <div v-if="!readingMode" class="pagination-bar pagination-bottom">
        <div class="pagination-info">
          显示第 {{ currentRange.start }}-{{ currentRange.end }} 条，共 {{ filteredMessages.length }} 条
          <span v-if="searchQuery" class="filter-hint">（已过滤）</span>
        </div>
        <div class="pagination-controls">
          <button @click="goToPage(1)" :disabled="currentPage === 1" class="page-btn" title="首页">⟨⟨</button>
          <button @click="prevPage" :disabled="currentPage === 1" class="page-btn" title="上一页">⟨</button>
          <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
          <button @click="nextPage" :disabled="currentPage === totalPages" class="page-btn" title="下一页">⟩</button>
          <button @click="goToPage(totalPages)" :disabled="currentPage === totalPages" class="page-btn"
            title="末页">⟩⟩</button>
          <select v-model.number="pageSize" @change="onPageSizeChange" class="page-size-select">
            <option :value="10">10条/页</option>
            <option :value="20">20条/页</option>
            <option :value="50">50条/页</option>
            <option :value="100">100条/页</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="selectionMenu.show" class="selection-menu"
      :style="{ left: selectionMenu.x + 'px', top: selectionMenu.y + 'px' }">
      <button @click="favoriteSelectedText" class="selection-btn">☆ 收藏</button>
      <button @click="highlightSelectedText" class="selection-btn">🖍 划线</button>
      <button @click="copySelectedText" class="selection-btn">
        <Icon icon="icon-park-twotone:copy" style="vertical-align: -2px; margin-right: 2px;" /> 复制
      </button>
    </div>

    <div v-if="exportDialog.show" class="export-dialog-overlay" @click.self="closeExportDialog">
      <div class="export-dialog">
        <div class="export-dialog-header">
          <h3>导出楼层范围</h3>
          <button @click="closeExportDialog" class="btn-icon">✕</button>
        </div>
        <div class="export-dialog-body">
          <div class="export-range">
            <div class="range-inputs">
              <div class="range-input-group">
                <label>起始楼层</label>
                <input type="number" v-model.number="exportDialog.startFloor" :min="1" :max="filteredMessages.length"
                  class="range-input" />
              </div>
              <span class="range-separator">至</span>
              <div class="range-input-group">
                <label>结束楼层</label>
                <input type="number" v-model.number="exportDialog.endFloor" :min="1" :max="filteredMessages.length"
                  class="range-input" />
              </div>
            </div>
            <div class="range-hint">
              共 {{ filteredMessages.length }} 条消息，将导出 {{ getExportCount() }} 条
            </div>
          </div>

          <div class="export-options">
            <label class="export-option">
              <input type="checkbox" v-model="exportDialog.includeName" />
              包含发言者名称
            </label>
            <label class="export-option">
              <input type="checkbox" v-model="exportDialog.includeTime" />
              包含发送时间
            </label>
          </div>
          <div class="export-preview">
            <div class="export-preview-label">预览（前 3 条）：</div>
            <pre class="export-preview-content">{{ getExportPreview() }}</pre>
          </div>
        </div>
        <div class="export-dialog-footer">
          <button @click="closeExportDialog" class="btn btn-secondary">取消</button>
          <button @click="doExportRange" class="btn btn-primary">导出 TXT</button>
        </div>
      </div>
    </div>
    <div v-if="showIntimacyModal" class="modal-overlay" @click.self="showIntimacyModal = false">
      <div class="modal-dialog intimacy-dialog">
        <div class="modal-header">
          <h3>
            <Icon icon="bxs:heart" style="color: #e91e63; margin-right: 8px;" /> 情感档案
          </h3>
          <button @click="showIntimacyModal = false" class="modal-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">相识日期</div>
              <div class="stat-value text-sm">{{ intimacyData.firstDate || 'N/A' }}</div>
              <div class="stat-sub">距今 {{ intimacyData.daysSince }} 天</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">活跃天数</div>
              <div class="stat-value">{{ intimacyData.activeDays }} <span class="unit">天</span></div>
              <div class="stat-sub">累计陪伴</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">消息总数</div>
              <div class="stat-value">{{ intimacyData.totalMessages }}</div>
              <div class="stat-sub">{{ (intimacyData.totalChars / 10000).toFixed(1) }}万 字</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">重Roll次数</div>
              <div class="stat-value">{{ intimacyData.totalRerolls }}</div>
              <div class="stat-sub">再空回截断八股试试呢</div>
            </div>
          </div>

          <div class="calendar-section">
            <div class="calendar-header-row">
              <h4>陪伴日历</h4>
              <div class="heatmap-legend">
                <span>少</span>
                <span class="legend-item level-1"></span>
                <span class="legend-item level-2"></span>
                <span class="legend-item level-3"></span>
                <span class="legend-item level-4"></span>
                <span>多</span>
              </div>
            </div>

            <div v-if="intimacyData.calendarMonths.length > 0" class="calendar-widget">

              <div class="calendar-nav">
                <button @click="prevMonth" :disabled="currentMonthIndex >= intimacyData.calendarMonths.length - 1"
                  class="nav-btn" title="上个月">◀</button>

                <div class="current-month-label">
                  {{ intimacyData.calendarMonths[currentMonthIndex].year }}年
                  {{ intimacyData.calendarMonths[currentMonthIndex].month }}月
                </div>

                <button @click="nextMonth" :disabled="currentMonthIndex <= 0" class="nav-btn" title="下个月">▶</button>
              </div>

              <div class="month-card single-view">
                <div class="month-grid">
                  <div class="weekday-header">日</div>
                  <div class="weekday-header">一</div>
                  <div class="weekday-header">二</div>
                  <div class="weekday-header">三</div>
                  <div class="weekday-header">四</div>
                  <div class="weekday-header">五</div>
                  <div class="weekday-header">六</div>

                  <div v-for="n in intimacyData.calendarMonths[currentMonthIndex].paddingStart" :key="'pad-start-' + n"
                    class="day-cell padding"></div>

                  <div v-for="day in intimacyData.calendarMonths[currentMonthIndex].days" :key="day.dateStr"
                    :class="['day-cell', `level-${day.level}`, { 'has-data': day.count > 0 }]"
                    @mouseenter="showDayTooltip($event, day)" @mousemove="moveDayTooltip($event)"
                    @mouseleave="hideDayTooltip">
                    <span class="day-number">{{ day.dayNum }}</span>
                  </div>
                </div>
              </div>

              <div class="month-footer-stats">
                <div class="footer-stat">
                  <span class="f-label">本月消息</span>
                  <span class="f-value">{{ intimacyData.calendarMonths[currentMonthIndex].totalCount }}</span>
                </div>
                <div class="footer-divider"></div>
                <div class="footer-stat">
                  <span class="f-label">本月字数</span>
                  <span class="f-value">{{ intimacyData.calendarMonths[currentMonthIndex].totalChars }}</span>
                </div>
              </div>

            </div>

            <div v-else class="no-calendar-data">
              暂无日历数据
            </div>

            <div v-show="tooltip.show" class="custom-tooltip"
              :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
              <div class="tooltip-header">{{ tooltip.dateStr }}</div>
              <div class="tooltip-row">
                <Icon icon="pepicons-pencil:letter" class="tooltip-icon" />
                <span>{{ tooltip.count }} 条消息</span>
              </div>
              <div class="tooltip-row">
                <Icon icon="ri:draft-line" class="tooltip-icon" />
                <span>{{ tooltip.chars }} 字</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Icon } from '@iconify/vue';

export default {
  name: 'STReader',
  components: {
    Icon
  },
  data() {
    return {
      isDarkMode: false,
      metadata: {},
      messages: [],
      rawData: [],
      // 正则脚本管理
      regexScripts: [],
      showRegexManager: false,
      editingScript: null,
      scriptForm: {
        id: '',
        scriptName: '',
        findRegex: '',
        replaceString: '',
        disabled: false
      },
      dragIndex: null,
      // 分页
      currentPage: 1,
      pageSize: 10,
      // 搜索
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1,
      showSearchBar: false,
      // 编辑消息
      editingMessageIndex: null,
      editingContent: '',
      // 标签过滤
      tagFilters: [],
      showTagFilterManager: false,
      editingTagFilter: null,
      tagFilterForm: {
        id: '',
        name: '',
        tagName: '',
        mode: 'remove',
        disabled: false
      },
      // 收藏和划线
      favorites: [],            // 收藏的楼层和句子
      highlights: [],           // 高亮划线
      showFavoritesPanel: false,
      selectionMenu: {
        show: false,
        x: 0,
        y: 0,
        text: '',
        messageIndex: null
      },
      highlightMenu: {
        show: false,
        x: 0,
        y: 0,
        highlightId: null
      },
      // 导出对话框
      exportDialog: {
        show: false,
        startFloor: 1,
        endFloor: 1,
        includeName: true,
        includeTime: true
      },
      // 样式设置
      showStylePanel: false,
      textStyles: {
        fontFamily: 'system',
        fontSize: 16,
        lineHeight: 1.8,
        paragraphSpacing: 1,
        letterSpacing: 0,
        textColor: '#1a1a1a',
        italicColor: '#1a1a1a',
        underlineColor: '#1a1a1a',
        quoteColor: '#1a1a1a',
        textAlign: 'justify'
      },
      colorOptions: [
        { name: '默认黑', value: '#1a1a1a' },
        { name: '深灰', value: '#333333' },
        { name: '中灰', value: '#555555' },
        { name: '浅灰', value: '#666666' },
        { name: '棕色', value: '#5d4037' },
        { name: '深蓝', value: '#1a237e' }
      ],
      // 自定义字体
      customFonts: [],
      showCustomFontDialog: false,
      customFontForm: {
        name: '',
        url: '',
        file: null
      },
      // 阅读模式
      readingMode: false,
      toolbarVisible: false,
      readingCurrentPage: 1,
      readingTotalPages: 1,
      readingFullHtml: '',      // 完整合并后的HTML
      readingTouchStartX: 0,
      readingTouchStartY: 0,
      toolbarTimeout: null,
      windowWidth: 0,           // 窗口宽度
      resizeTimer: null,
      keepReadingPagePosition: false, // 用于控制翻页时是否保持位置
      showIntimacyModal: false,
      // 亲密度数据
      intimacyData: {
        firstDate: '',
        daysSince: 0,
        activeDays: 0,
        totalMessages: 0,
        totalChars: 0,
        totalRerolls: 0,
        calendarMonths: []
      },
      // 当前月份索引
      currentMonthIndex: 0,
      // 我讨厌emoji
      tooltip: {
        show: false,
        x: 0,
        y: 0,
        dateStr: '',
        count: 0,
        chars: 0
      },
    // 阅读模式能不能不要再错位了
    resizeObserver: null,
    };
  },
  computed: {
    // 过滤后的消息（搜索时使用）
    filteredMessages() {
      if (!this.searchQuery.trim()) {
        return this.messages;
      }
      const query = this.searchQuery.toLowerCase();
      return this.messages.filter((msg, index) => {
        const content = this.getMessageContent(msg).toLowerCase();
        const name = (msg.name || '').toLowerCase();
        const matches = content.includes(query) || name.includes(query);
        // 存储原始索引
        if (matches) {
          msg._originalIndex = index;
        }
        return matches;
      });
    },
    totalPages() {
      return Math.ceil(this.filteredMessages.length / this.pageSize);
    },
    paginatedMessages() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredMessages.slice(start, end);
    },
    currentRange() {
      const start = (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, this.filteredMessages.length);
      return { start, end };
    }
  },
  mounted() {
    // 确保 body 可以滚动（可能上次退出时未正确重置）
    document.body.style.overflow = '';

    // 从 localStorage 加载正则脚本和标签过滤器
    this.loadScriptsFromStorage();
    this.loadTagFiltersFromStorage();
    this.loadFavoritesFromStorage();
    this.loadHighlightsFromStorage();
    this.loadStylesFromStorage();
    this.loadDarkMode();
    this.loadCustomFonts();

    // 替换HTML占位符
    this.replaceHTMLPlaceholders();

    // 点击其他地方关闭选择菜单
    document.addEventListener('mousedown', this.hideSelectionMenu);

    window.addEventListener('keydown', this.handleKeydown);
  },

  updated() {
    // DOM更新后替换HTML占位符
    this.replaceHTMLPlaceholders();
    document.addEventListener('mousedown', this.hideHighlightMenu);

    // 监听高亮划线的点击事件
    document.addEventListener('click', this.onHighlightClick);

  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.hideSelectionMenu);
    document.removeEventListener('mousedown', this.hideHighlightMenu);
    document.removeEventListener('click', this.onHighlightClick);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeydown);
    // 确保重置 body overflow
    document.body.style.overflow = '';
    if (this.toolbarTimeout) {
      clearTimeout(this.toolbarTimeout);
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
  },
  methods: {
    // === 夜间模式相关方法 ===
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;

      const blackColors = ['#000000', '#1a1a1a', '#333333'];
      const lightColor = '#e0e0e0'; // 统一的新默认色

      // 旧的颜色（用于识别是否需要替换）
      const oldGray = '#bfbfbf';
      const oldDim = '#888888';

      if (this.isDarkMode) {
        // === 切到夜间 ===

        // 只要是黑色系或者旧的灰色，统统变成新的 #e0e0e0
        if (blackColors.includes(this.textStyles.textColor) || this.textStyles.textColor === oldGray) {
          this.textStyles.textColor = lightColor;
        }

        if (blackColors.includes(this.textStyles.italicColor) || this.textStyles.italicColor === oldGray) {
          this.textStyles.italicColor = lightColor;
        }

        if (blackColors.includes(this.textStyles.underlineColor) || this.textStyles.underlineColor === oldGray) {
          this.textStyles.underlineColor = lightColor;
        }

        // 引用也统一变成亮色，不再用暗灰色
        if (blackColors.includes(this.textStyles.quoteColor) || this.textStyles.quoteColor === oldGray || this.textStyles.quoteColor === oldDim) {
          this.textStyles.quoteColor = lightColor;
        }

        document.body.style.backgroundColor = '#121212';

      } else {
        // === 切回日间 ===

        const nightColors = [lightColor, oldGray, oldDim];

        if (nightColors.includes(this.textStyles.textColor)) this.textStyles.textColor = '#1a1a1a';
        if (nightColors.includes(this.textStyles.italicColor)) this.textStyles.italicColor = '#1a1a1a';
        if (nightColors.includes(this.textStyles.underlineColor)) this.textStyles.underlineColor = '#1a1a1a';
        if (nightColors.includes(this.textStyles.quoteColor)) this.textStyles.quoteColor = '#1a1a1a';

        document.body.style.backgroundColor = '';
      }

      this.saveStylesToStorage();
      localStorage.setItem('st_reader_dark_mode', this.isDarkMode);
    },

    // 修改 loadStylesFromStorage 或 mounted，初始化时读取夜间模式设置
    loadDarkMode() {
      const saved = localStorage.getItem('st_reader_dark_mode');
      if (saved === 'true') {
        this.isDarkMode = true;
        document.body.style.backgroundColor = '#121212';
      }
    },

    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.parseJSONL(e.target.result);
      };
      reader.readAsText(file);
    },

    parseJSONL(content) {
      const lines = content.trim().split('\n');
      this.rawData = [];
      this.messages = [];
      this.metadata = {};

      lines.forEach((line, index) => {
        try {
          const data = JSON.parse(line);
          if (index === 0 && !data.mes) {
            // 第一行可能是元数据
            this.metadata = data;
          } else {
            // 消息数据
            // 更健壮地处理 is_user（可能是 boolean、number、string）
            let isUser = false;
            if (data.is_user === true || data.is_user === 1 || data.is_user === 'true') {
              isUser = true;
            }

            // 处理 swipes（多条回复选项）
            let swipes = [];
            if (data.swipes && Array.isArray(data.swipes) && data.swipes.length > 1) {
              swipes = data.swipes;
            }

            const message = {
              name: data.name || '未知',
              is_user: isUser,
              mes: data.mes || '',
              send_date: data.send_date || null,
              model: data.extra?.model || null,
              force_avatar: data.force_avatar || null,
              showPreview: false,  // 用于控制 HTML 预览显示
              swipes: swipes,
              currentSwipeIndex: data.swipe_id || 0  // 当前选中的 swipe 索引
            };

            this.messages.push(message);
          }
        } catch (error) {
          console.error(`解析第 ${index + 1} 行时出错:`, error);
        }
      });
    },

    hasHTMLCodeBlock(content) {
      if (!content) return false;
      // 检测是否包含 ```html 或 ``` 代码块，并且其中包含完整的 HTML 文档
      const codeBlockPattern = /```(?:html)?\s*([\s\S]*?)```/i;
      const match = content.match(codeBlockPattern);
      if (!match) return false;

      const codeContent = match[1].trim();
      const hasDoctype = /<!DOCTYPE\s+html>/i.test(codeContent);
      const hasHtmlTag = /<html[\s>]/i.test(codeContent);

      return hasDoctype && hasHtmlTag;
    },

    extractHTMLFromCodeBlock(content) {
      if (!content) return '';
      const codeBlockPattern = /```(?:html)?\s*([\s\S]*?)```/i;
      const match = content.match(codeBlockPattern);
      return match ? match[1].trim() : '';
    },

    renderContentWithoutCodeBlock(content) {
      if (!content) return '';
      // 先应用标签过滤，再应用正则脚本处理原始内容
      let processedContent = this.applyTagFilters(content);
      processedContent = this.applyRegexScripts(processedContent);
      // 移除 HTML 代码块，只保留正文
      const withoutCodeBlock = processedContent.replace(/```(?:html)?\s*[\s\S]*?```/gi, '').trim();
      // 注意：这里不再调用 renderContent（已经处理过正则了），直接渲染 markdown
      return this.renderMarkdown(withoutCodeBlock);
    },

    renderContentWithHTMLPlaceholder(content, messageIndex) {
      if (!content) return '';
      // 先应用标签过滤，再应用正则脚本处理原始内容
      let processedContent = this.applyTagFilters(content);
      processedContent = this.applyRegexScripts(processedContent);

      // 提取HTML代码块内容
      const htmlContent = this.extractHTMLFromCodeBlock(processedContent);

      if (!htmlContent) {
        // 如果没有HTML代码块，直接渲染
        return this.renderMarkdown(processedContent);
      }

      // 用特殊占位符替换HTML代码块，保留位置
      // 使用data属性存储HTML内容（base64编码避免转义问题）
      const base64Html = btoa(unescape(encodeURIComponent(htmlContent)));
      const placeholder = `<div class="html-preview-placeholder" data-html-base64="${base64Html}" data-message-idx="${messageIndex}"></div>`;

      const withPlaceholder = processedContent.replace(
        /```(?:html)?\s*[\s\S]*?```/gi,
        placeholder
      );

      // 渲染Markdown
      return this.renderMarkdown(withPlaceholder);
    },

    replaceHTMLPlaceholders() {
      // 只在当前组件范围内查找占位符
      const placeholders = this.$el?.querySelectorAll('.html-preview-placeholder') || [];
      placeholders.forEach(placeholder => {
        const base64Html = placeholder.getAttribute('data-html-base64');
        if (base64Html && placeholder.parentNode) {
          try {
            const htmlContent = decodeURIComponent(escape(atob(base64Html)));
            const iframe = document.createElement('iframe');
            iframe.className = 'html-iframe';
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            iframe.srcdoc = htmlContent;

            const wrapper = document.createElement('div');
            wrapper.className = 'html-preview-section';
            wrapper.appendChild(iframe);

            placeholder.parentNode.replaceChild(wrapper, placeholder);
          } catch (e) {
            console.error('替换HTML占位符失败:', e);
          }
        }
      });
    },

    renderMarkdown(content) {
      if (!content) return '';

      // 配置 marked 选项，允许 HTML
      marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        mangle: false,
        headerIds: false
      });

      let html = marked.parse(content);

      // 使用与 renderContent 相同的 DOMPurify 配置
      html = DOMPurify.sanitize(html, this.getDOMPurifyConfig());

      return html;
    },

    // 统一的 DOMPurify 配置
    getDOMPurifyConfig() {
      return {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 'del', 'code', 'pre', 'blockquote',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'a', 'img',
          'span', 'div',
          'b', 'i', 's', 'strike', 'sub', 'sup',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'hr', 'details', 'summary',
          // 扩展标签 - 支持正则脚本生成的富文本
          'style', 'mark', 'small', 'big', 'abbr', 'cite', 'q',
          'dl', 'dt', 'dd', 'figure', 'figcaption', 'main', 'section', 'article',
          'header', 'footer', 'nav', 'aside', 'address', 'time', 'ruby', 'rt', 'rp',
          'button', 'label', 'input', 'select', 'option', 'textarea',
          'fieldset', 'legend', 'meter', 'progress', 'output',
          'canvas', 'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline',
          'g', 'defs', 'use', 'symbol', 'text', 'tspan'
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'style',
          'width', 'height', 'align', 'target', 'rel',
          'id', 'name',
          // 扩展属性
          'type', 'value', 'placeholder', 'disabled', 'readonly', 'checked',
          'min', 'max', 'step', 'pattern', 'required', 'multiple',
          'rows', 'cols', 'wrap', 'for', 'form',
          'open', 'datetime', 'cite', 'download',
          // SVG 属性
          'd', 'fill', 'stroke', 'stroke-width', 'viewBox', 'xmlns',
          'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
          'points', 'transform', 'opacity', 'font-size', 'text-anchor',
          // 事件属性（用于交互式内容）
          'onclick', 'onchange', 'oninput',
          // Reading mode needs data attributes
          'data-floor'
        ],
        ALLOW_DATA_ATTR: true
      };
    },

    isFullHTML(content) {
      if (!content) return false;

      const trimmed = content.trim();

      // 如果内容以 Markdown 代码块开头（```），则不是完整的 HTML 文档
      if (/^```/.test(trimmed)) {
        return false;
      }

      // 更严格的检测：必须同时包含 DOCTYPE 和 html 标签，或者以 <html 开头
      const hasDoctype = /<!DOCTYPE\s+html>/i.test(trimmed);
      const hasHtmlTag = /<html[\s>]/i.test(trimmed);
      const startsWithHtml = /^<html[\s>]/i.test(trimmed);

      // 只有当内容以 <!DOCTYPE 或 <html 开头时才认为是完整 HTML 文档
      return (hasDoctype && hasHtmlTag) || startsWithHtml;
    },

    toggleHTMLPreview(index) {
      this.messages[index].showPreview = !this.messages[index].showPreview;
    },

    // Swipe 切换方法
    getMessageContent(message) {
      // 如果有 swipes 且当前索引有效，返回对应的 swipe 内容
      if (message.swipes && message.swipes.length > 0) {
        return message.swipes[message.currentSwipeIndex] || message.mes;
      }
      return message.mes;
    },

    prevSwipe(messageIndex) {
      const message = this.messages[messageIndex];
      if (message.swipes && message.currentSwipeIndex > 0) {
        message.currentSwipeIndex--;
      }
    },

    nextSwipe(messageIndex) {
      const message = this.messages[messageIndex];
      if (message.swipes && message.currentSwipeIndex < message.swipes.length - 1) {
        message.currentSwipeIndex++;
      }
    },

    // 获取全局消息索引（用于分页后的消息）
    getGlobalMessageIndex(localIndex) {
      return (this.currentPage - 1) * this.pageSize + localIndex;
    },

    // ========== 编辑消息方法 ==========

    toggleEditMessage(globalIndex) {
      if (this.editingMessageIndex === globalIndex) {
        // 取消编辑
        this.cancelEditMessage();
      } else {
        // 开始编辑
        const message = this.messages[globalIndex];
        // 获取当前 swipe 的原始内容
        this.editingContent = this.getMessageContent(message);
        this.editingMessageIndex = globalIndex;
      }
    },

    cancelEditMessage() {
      this.editingMessageIndex = null;
      this.editingContent = '';
    },

    saveEditMessage() {
      if (this.editingMessageIndex === null) return;

      const message = this.messages[this.editingMessageIndex];

      // 如果有 swipes，更新当前 swipe 的内容
      if (message.swipes && message.swipes.length > 0) {
        message.swipes[message.currentSwipeIndex] = this.editingContent;
      } else {
        // 否则直接更新 mes
        message.mes = this.editingContent;
      }

      this.cancelEditMessage();
    },

    renderContent(content, messageIndex) {
      if (!content) return '';

      // 先应用标签过滤
      let processedContent = this.applyTagFilters(content);

      // 再应用正则脚本
      processedContent = this.applyRegexScripts(processedContent);

      // 提取并保护 HTML 块
      const htmlBlocks = [];
      let tempContent = processedContent;

      // 【修改处】：去掉双下划线，改用 Markdown 不会误触的格式
      // 使用这种格式： {ST_HTML_BLOCK_0}
      const placeholder = (i) => `{ST_READER_HTML_BLOCK_${i}}`;

      // 提取包含 <style> 的完整 HTML 块
      const styleIndex = tempContent.indexOf('<style');
      if (styleIndex !== -1) {
        let htmlEnd = tempContent.length;
        const afterStyle = tempContent.substring(styleIndex);

        let lastDivEnd = -1;
        let divEnd = afterStyle.indexOf('</div>', 0);
        while (divEnd !== -1) {
          lastDivEnd = divEnd + 6;
          divEnd = afterStyle.indexOf('</div>', divEnd + 1);
        }

        if (lastDivEnd !== -1) {
          const afterLastDiv = afterStyle.substring(lastDivEnd).trim();
          if (!afterLastDiv.startsWith('<') || afterLastDiv.startsWith('</')) {
            htmlEnd = styleIndex + lastDivEnd;
          }
        }

        const htmlBlock = tempContent.substring(styleIndex, htmlEnd);
        htmlBlocks.push(htmlBlock);
        // 【修改处】：插入新格式的占位符
        tempContent = tempContent.substring(0, styleIndex) + placeholder(0) + tempContent.substring(htmlEnd);
      }

      // 提取 <details> 块
      tempContent = tempContent.replace(/<details[\s\S]*?<\/details>/gi, (match) => {
        htmlBlocks.push(match);
        // 【修改处】：插入新格式的占位符
        return placeholder(htmlBlocks.length - 1);
      });

      // 配置 marked
      marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        mangle: false,
        headerIds: false
      });

      // 解析 Markdown
      let html = marked.parse(tempContent);

      // 还原 HTML 块
      htmlBlocks.forEach((block, i) => {
        const ph = placeholder(i);
        // 优先替换被 p 标签包裹的占位符
        // 因为 marked 通常会把这一行文字包裹在 <p> 中
        if (html.includes(`<p>${ph}</p>`)) {
          html = html.replace(`<p>${ph}</p>`, block);
        } else {
          html = html.replace(ph, block);
        }
      });

      // DOMPurify 清理
      html = DOMPurify.sanitize(html, this.getDOMPurifyConfig());

      // 应用高亮
      if (messageIndex !== undefined) {
        html = this.applyHighlights(html, messageIndex);
      }

      return html;
    },

    // 应用高亮划线效果（需要传入消息索引）
    applyHighlights(html, messageIndex) {
      if (!this.highlights || this.highlights.length === 0) return html;

      let result = html;
      for (const highlight of this.highlights) {
        // 只在对应的消息中应用高亮
        if (highlight.text && highlight.messageIndex === messageIndex) {
          // 转义特殊字符用于正则
          const escapedText = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          try {
            // 只替换第一个匹配（避免重复高亮）
            const regex = new RegExp(`(${escapedText})`);
            result = result.replace(regex, `<span class="user-highlight" data-highlight-id="${highlight.id}">$1</span>`);
          } catch (e) {
            // 忽略无效的正则
          }
        }
      }
      return result;
    },

    formatDate(timestamp) {
      if (!timestamp) return '';

      let date;

      if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          date = new Date(parseInt(timestamp));
        }
      } else {
        return '';
      }

      if (isNaN(date.getTime())) return '';

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}`;
    },

    resetReader() {
      this.metadata = {};
      this.messages = [];
      this.rawData = [];
      this.currentPage = 1;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    // ========== 分页方法 ==========

    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.scrollToTop();
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.scrollToTop();
      }
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
        this.scrollToTop();
      }
    },

    onPageSizeChange() {
      // 重新计算当前页，确保不超出范围
      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages || 1;
      }
      this.scrollToTop();
    },

    scrollToTop() {
      this.$nextTick(() => {
        const wrapper = document.querySelector('.messages-wrapper');
        if (wrapper) {
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    },

    // ========== 搜索方法 ==========

    toggleSearchBar() {
      this.showSearchBar = !this.showSearchBar;
      if (!this.showSearchBar) {
        this.clearSearch();
      } else {
        this.$nextTick(() => {
          const input = document.querySelector('.search-input');
          if (input) input.focus();
        });
      }
    },

    onSearchInput() {
      // 搜索时重置到第一页
      this.currentPage = 1;
    },

    clearSearch() {
      this.searchQuery = '';
      this.currentPage = 1;
    },

    // ========== 收藏和划线方法 ==========

    loadFavoritesFromStorage() {
      try {
        const saved = localStorage.getItem('st_reader_favorites');
        if (saved) {
          this.favorites = JSON.parse(saved);
        }
      } catch (e) {
        console.error('加载收藏失败:', e);
      }
    },

    saveFavoritesToStorage() {
      try {
        localStorage.setItem('st_reader_favorites', JSON.stringify(this.favorites));
      } catch (e) {
        console.error('保存收藏失败:', e);
      }
    },

    loadHighlightsFromStorage() {
      try {
        const saved = localStorage.getItem('st_reader_highlights');
        if (saved) {
          this.highlights = JSON.parse(saved);
        }
      } catch (e) {
        console.error('加载高亮失败:', e);
      }
    },

    saveHighlightsToStorage() {
      try {
        localStorage.setItem('st_reader_highlights', JSON.stringify(this.highlights));
      } catch (e) {
        console.error('保存高亮失败:', e);
      }
    },

    toggleFavoritesPanel() {
      this.showFavoritesPanel = !this.showFavoritesPanel;
    },

    // 收藏整个楼层
    toggleFavoriteMessage(globalIndex, message) {
      const existingIndex = this.favorites.findIndex(
        f => f.type === 'message' && f.messageIndex === globalIndex
      );

      if (existingIndex !== -1) {
        // 取消收藏
        this.favorites.splice(existingIndex, 1);
      } else {
        // 添加收藏
        this.favorites.unshift({
          id: this.generateUUID(),
          type: 'message',
          messageIndex: globalIndex,
          text: this.getMessageContent(message),
          speaker: message.name,
          createdAt: Date.now()
        });
      }
      this.saveFavoritesToStorage();
    },

    isMessageFavorited(globalIndex) {
      return this.favorites.some(f => f.type === 'message' && f.messageIndex === globalIndex);
    },

    // 文本选择处理
    handleTextSelection(event, messageIndex, message) {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText.length > 0) {
        // 显示选择菜单
        this.selectionMenu = {
          show: true,
          x: event.clientX,
          y: event.clientY - 40,
          text: selectedText,
          messageIndex: messageIndex,
          speaker: message.name
        };
      }
    },

    hideSelectionMenu(event) {
      // 如果点击的不是菜单本身，则隐藏
      if (!event.target.closest('.selection-menu')) {
        this.selectionMenu.show = false;
      }
    },

    favoriteSelectedText() {
      if (!this.selectionMenu.text) return;

      this.favorites.unshift({
        id: this.generateUUID(),
        type: 'text',
        messageIndex: this.selectionMenu.messageIndex,
        text: this.selectionMenu.text,
        speaker: this.selectionMenu.speaker,
        createdAt: Date.now()
      });

      this.saveFavoritesToStorage();
      this.selectionMenu.show = false;
      window.getSelection().removeAllRanges();
    },

    highlightSelectedText() {
      if (!this.selectionMenu.text) return;

      this.highlights.push({
        id: this.generateUUID(),
        messageIndex: this.selectionMenu.messageIndex,
        text: this.selectionMenu.text,
        createdAt: Date.now()
      });

      this.saveHighlightsToStorage();
      this.selectionMenu.show = false;
      window.getSelection().removeAllRanges();

      // 如果在阅读模式，刷新内容以显示新的划线
      if (this.readingMode) {
        this.generateReadingContent();
      }
    },

    deleteHighlight(id) {
      const index = this.highlights.findIndex(h => h.id === id);
      if (index !== -1) {
        this.highlights.splice(index, 1);
        this.saveHighlightsToStorage();

        // 如果在阅读模式，刷新内容
        if (this.readingMode) {
          this.generateReadingContent();
        }
      }
    },

    onHighlightClick(event) {
      const target = event.target.closest('.user-highlight');
      if (target && target.dataset.highlightId) {
        event.preventDefault();
        event.stopPropagation();
        this.highlightMenu = {
          show: true,
          x: event.clientX,
          y: event.clientY,
          highlightId: target.dataset.highlightId
        };
      }
    },

    removeHighlightFromMenu() {
      if (this.highlightMenu.highlightId) {
        this.deleteHighlight(this.highlightMenu.highlightId);
      }
      this.highlightMenu.show = false;
    },

    hideHighlightMenu(event) {
      // 如果点击的不是菜单本身，则隐藏
      if (!event || !event.target.closest('.highlight-menu')) {
        this.highlightMenu.show = false;
      }
    },

    // 导航到收藏对应的楼层
    navigateToFavorite(fav) {
      if (fav.messageIndex === undefined || fav.messageIndex === null) return;

      const messageIndex = fav.messageIndex;

      // 计算目标页码
      const targetPage = Math.floor(messageIndex / this.pageSize) + 1;

      // 跳转到对应页
      if (targetPage !== this.currentPage) {
        this.currentPage = targetPage;
      }

      // 关闭收藏夹面板
      this.showFavoritesPanel = false;

      // 等待 DOM 更新后滚动到对应消息
      this.$nextTick(() => {
        const localIndex = messageIndex % this.pageSize;
        const messageBlocks = document.querySelectorAll('.message-block');
        if (messageBlocks[localIndex]) {
          messageBlocks[localIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 添加高亮闪烁效果
          messageBlocks[localIndex].classList.add('highlight-flash');
          setTimeout(() => {
            messageBlocks[localIndex].classList.remove('highlight-flash');
          }, 2000);
        }
      });
    },

    copySelectedText() {
      if (!this.selectionMenu.text) return;

      navigator.clipboard.writeText(this.selectionMenu.text).then(() => {
        this.selectionMenu.show = false;
      });
    },

    copyFavorite(fav) {
      navigator.clipboard.writeText(fav.text);
    },

    deleteFavorite(id) {
      this.favorites = this.favorites.filter(f => f.id !== id);
      this.saveFavoritesToStorage();
    },

    clearAllFavorites() {
      if (confirm('确定要清空所有收藏吗？')) {
        this.favorites = [];
        this.saveFavoritesToStorage();
      }
    },

    exportFavorites() {
      const dataStr = JSON.stringify(this.favorites, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'favorites.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    formatFavoriteTime(timestamp) {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    // ========== 标签过滤管理方法 ==========

    loadTagFiltersFromStorage() {
      try {
        const saved = localStorage.getItem('st_reader_tag_filters');
        if (saved) {
          this.tagFilters = JSON.parse(saved);
        }
      } catch (e) {
        console.error('加载标签过滤器失败:', e);
      }
    },

    saveTagFiltersToStorage() {
      try {
        localStorage.setItem('st_reader_tag_filters', JSON.stringify(this.tagFilters));
      } catch (e) {
        console.error('保存标签过滤器失败:', e);
      }
    },

    toggleTagFilterManager() {
      this.showTagFilterManager = !this.showTagFilterManager;
      if (!this.showTagFilterManager) {
        this.resetTagFilterForm();
      }
    },

    resetTagFilterForm() {
      this.editingTagFilter = null;
      this.tagFilterForm = {
        id: '',
        name: '',
        tagName: '',
        mode: 'remove',
        disabled: false
      };
    },

    addNewTagFilter() {
      this.resetTagFilterForm();
      this.tagFilterForm.id = this.generateUUID();
    },

    editTagFilter(filter) {
      this.editingTagFilter = filter.id;
      this.tagFilterForm = { ...filter };
    },

    saveTagFilter() {
      if (!this.tagFilterForm.name || !this.tagFilterForm.tagName) {
        alert('请填写过滤器名称和标签名');
        return;
      }

      if (this.editingTagFilter) {
        const index = this.tagFilters.findIndex(f => f.id === this.editingTagFilter);
        if (index !== -1) {
          this.tagFilters.splice(index, 1, { ...this.tagFilterForm });
        }
      } else {
        this.tagFilters.push({ ...this.tagFilterForm });
      }

      this.saveTagFiltersToStorage();
      this.resetTagFilterForm();
    },

    cancelEditTagFilter() {
      this.resetTagFilterForm();
    },

    deleteTagFilter(id) {
      if (confirm('确定要删除这个过滤器吗？')) {
        this.tagFilters = this.tagFilters.filter(f => f.id !== id);
        this.saveTagFiltersToStorage();
      }
    },

    toggleTagFilter(filter) {
      filter.disabled = !filter.disabled;
      this.saveTagFiltersToStorage();
    },

    moveTagFilterUp(index) {
      if (index > 0) {
        const temp = this.tagFilters[index];
        this.tagFilters.splice(index, 1);
        this.tagFilters.splice(index - 1, 0, temp);
        this.saveTagFiltersToStorage();
      }
    },

    moveTagFilterDown(index) {
      if (index < this.tagFilters.length - 1) {
        const temp = this.tagFilters[index];
        this.tagFilters.splice(index, 1);
        this.tagFilters.splice(index + 1, 0, temp);
        this.saveTagFiltersToStorage();
      }
    },

    // 应用标签过滤处理文本
    applyTagFilters(text) {
      if (!text) return text;

      let result = text;

      for (const filter of this.tagFilters) {
        if (filter.disabled) continue;

        try {
          // 支持多个标签，用逗号分隔
          const tags = filter.tagName.split(',').map(t => t.trim()).filter(t => t);

          for (const tag of tags) {
            // 转义特殊字符
            const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            if (filter.mode === 'remove') {
              // 删除标签及其内容
              const regex = new RegExp(`<${escapedTag}[^>]*>[\\s\\S]*?<\\/${escapedTag}>`, 'gi');
              result = result.replace(regex, '');
              // 也处理自闭合标签
              const selfClosingRegex = new RegExp(`<${escapedTag}[^>]*/?>`, 'gi');
              result = result.replace(selfClosingRegex, '');
            } else if (filter.mode === 'keep') {
              // 只保留标签内的内容
              const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
              const matches = [];
              let match;
              while ((match = regex.exec(text)) !== null) {
                matches.push(match[1]);
              }
              if (matches.length > 0) {
                result = matches.join('\n\n');
              }
            } else if (filter.mode === 'unwrap') {
              // 移除标签但保留内容
              const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
              result = result.replace(regex, '$1');
              // 也处理自闭合标签
              const selfClosingRegex = new RegExp(`<${escapedTag}[^>]*/?>`, 'gi');
              result = result.replace(selfClosingRegex, '');
            }
          }
        } catch (e) {
          console.error(`标签过滤器 "${filter.name}" 执行失败:`, e);
        }
      }

      return result;
    },

    // ========== 正则脚本管理方法 ==========

    loadScriptsFromStorage() {
      try {
        const saved = localStorage.getItem('st_reader_regex_scripts');
        if (saved) {
          this.regexScripts = JSON.parse(saved);
        }
      } catch (e) {
        console.error('加载正则脚本失败:', e);
      }
    },

    saveScriptsToStorage() {
      try {
        localStorage.setItem('st_reader_regex_scripts', JSON.stringify(this.regexScripts));
      } catch (e) {
        console.error('保存正则脚本失败:', e);
      }
    },

    toggleRegexManager() {
      this.showRegexManager = !this.showRegexManager;
      if (!this.showRegexManager) {
        this.resetScriptForm();
      }
    },

    resetScriptForm() {
      this.editingScript = null;
      this.scriptForm = {
        id: '',
        scriptName: '',
        findRegex: '',
        replaceString: '',
        disabled: false
      };
    },

    addNewScript() {
      this.resetScriptForm();
      this.scriptForm.id = this.generateUUID();
    },

    editScript(script) {
      this.editingScript = script.id;
      this.scriptForm = { ...script };
    },

    saveScript() {
      if (!this.scriptForm.scriptName || !this.scriptForm.findRegex) {
        alert('请填写脚本名称和正则表达式');
        return;
      }

      if (this.editingScript) {
        // 编辑现有脚本
        const index = this.regexScripts.findIndex(s => s.id === this.editingScript);
        if (index !== -1) {
          this.regexScripts.splice(index, 1, { ...this.scriptForm });
        }
      } else {
        // 添加新脚本
        this.regexScripts.push({ ...this.scriptForm });
      }

      this.saveScriptsToStorage();
      this.resetScriptForm();
    },

    cancelEdit() {
      this.resetScriptForm();
    },

    deleteScript(id) {
      if (confirm('确定要删除这个正则脚本吗？')) {
        this.regexScripts = this.regexScripts.filter(s => s.id !== id);
        this.saveScriptsToStorage();
      }
    },

    toggleScript(script) {
      script.disabled = !script.disabled;
      this.saveScriptsToStorage();
    },

    moveScriptUp(index) {
      if (index > 0) {
        const temp = this.regexScripts[index];
        this.regexScripts.splice(index, 1);
        this.regexScripts.splice(index - 1, 0, temp);
        this.saveScriptsToStorage();
      }
    },

    moveScriptDown(index) {
      if (index < this.regexScripts.length - 1) {
        const temp = this.regexScripts[index];
        this.regexScripts.splice(index, 1);
        this.regexScripts.splice(index + 1, 0, temp);
        this.saveScriptsToStorage();
      }
    },

    // 拖拽排序
    handleDragStart(index) {
      this.dragIndex = index;
    },

    handleDragOver(e) {
      e.preventDefault();
    },

    handleDrop(e, dropIndex) {
      e.preventDefault();
      if (this.dragIndex !== null && this.dragIndex !== dropIndex) {
        const draggedScript = this.regexScripts[this.dragIndex];
        this.regexScripts.splice(this.dragIndex, 1);
        this.regexScripts.splice(dropIndex, 0, draggedScript);
        this.saveScriptsToStorage();
      }
      this.dragIndex = null;
    },

    handleDragEnd() {
      this.dragIndex = null;
    },

    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    importScripts() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true; // <--- 【关键修改】开启多选支持

      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        let successCount = 0;
        let scriptCount = 0;

        // 封装读取文件的函数为 Promise
        const readFile = (file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const data = JSON.parse(event.target.result);
                resolve(data);
              } catch (err) {
                console.error(`解析文件 ${file.name} 失败:`, err);
                resolve(null);
              }
            };
            reader.readAsText(file);
          });
        };

        // 并发读取所有选中的文件
        const results = await Promise.all(files.map(file => readFile(file)));

        // 处理结果
        results.forEach(data => {
          if (!data) return;
          successCount++;

          // 支持导入单个脚本对象 或 脚本数组
          const scripts = Array.isArray(data) ? data : [data];

          scripts.forEach(script => {
            // 确保有必要的字段
            if (script.findRegex) {
              const newScript = {
                id: script.id || this.generateUUID(),
                scriptName: script.scriptName || '未命名脚本',
                findRegex: script.findRegex,
                replaceString: script.replaceString || '',
                disabled: script.disabled || false
              };

              // 检查是否已存在（防止重复添加完全一样的）
              const existingIndex = this.regexScripts.findIndex(s => s.id === newScript.id);
              if (existingIndex !== -1) {
                // 如果 ID 相同，更新它
                this.regexScripts.splice(existingIndex, 1, newScript);
              } else {
                // 否则添加新的
                this.regexScripts.push(newScript);
              }
              scriptCount++;
            }
          });
        });

        if (scriptCount > 0) {
          this.saveScriptsToStorage();
          alert(`成功从 ${successCount} 个文件中导入了 ${scriptCount} 个脚本`);
        } else {
          alert('未找到有效的正则脚本数据');
        }
      };

      input.click();
    },

    exportScripts() {
      const dataStr = JSON.stringify(this.regexScripts, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'regex_scripts.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    // 从角色卡 PNG 导入正则脚本
    importFromPNG() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const arrayBuffer = await file.arrayBuffer();
          const charData = this.extractPNGChara(arrayBuffer);

          if (!charData) {
            alert('未能从 PNG 中读取角色数据，请确保这是一个有效的角色卡文件。');
            return;
          }

          // 解析 JSON
          const cardData = JSON.parse(charData);

          // 查找正则脚本
          let regexScripts = null;

          // 尝试多种可能的路径
          if (cardData.data?.extensions?.regex_scripts) {
            regexScripts = cardData.data.extensions.regex_scripts;
          } else if (cardData.extensions?.regex_scripts) {
            regexScripts = cardData.extensions.regex_scripts;
          } else if (cardData.regex_scripts) {
            regexScripts = cardData.regex_scripts;
          }

          if (!regexScripts || !Array.isArray(regexScripts) || regexScripts.length === 0) {
            alert('该角色卡中没有找到正则脚本。');
            return;
          }

          // 导入脚本
          let importCount = 0;
          regexScripts.forEach(script => {
            if (script.findRegex) {
              const newScript = {
                id: script.id || this.generateUUID(),
                scriptName: script.scriptName || '未命名脚本',
                findRegex: script.findRegex,
                replaceString: script.replaceString || '',
                disabled: script.disabled || false
              };

              // 检查是否已存在（按 id 或名称）
              const existingIndex = this.regexScripts.findIndex(
                s => s.id === newScript.id || s.scriptName === newScript.scriptName
              );

              if (existingIndex !== -1) {
                // 询问是否覆盖
                if (confirm(`脚本 "${newScript.scriptName}" 已存在，是否覆盖？`)) {
                  this.regexScripts.splice(existingIndex, 1, newScript);
                  importCount++;
                }
              } else {
                this.regexScripts.push(newScript);
                importCount++;
              }
            }
          });

          this.saveScriptsToStorage();
          alert(`成功从角色卡导入 ${importCount} 个正则脚本！`);

        } catch (err) {
          console.error('导入失败:', err);
          alert('导入失败: ' + err.message);
        }
      };
      input.click();
    },

    // 从 PNG ArrayBuffer 中提取 chara 数据
    extractPNGChara(arrayBuffer) {
      const bytes = new Uint8Array(arrayBuffer);

      // PNG 签名: 89 50 4E 47 0D 0A 1A 0A
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      for (let i = 0; i < 8; i++) {
        if (bytes[i] !== pngSignature[i]) {
          throw new Error('不是有效的 PNG 文件');
        }
      }

      let offset = 8;

      while (offset < bytes.length) {
        // 读取 chunk 长度 (4 bytes, big-endian)
        const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 4;

        // 读取 chunk 类型 (4 bytes)
        const type = String.fromCharCode(bytes[offset], bytes[offset + 1],
          bytes[offset + 2], bytes[offset + 3]);
        offset += 4;

        // 检查是否是 tEXt chunk
        if (type === 'tEXt') {
          // 读取数据
          const data = bytes.slice(offset, offset + length);

          // 查找 null 分隔符
          let nullIndex = -1;
          for (let i = 0; i < data.length; i++) {
            if (data[i] === 0) {
              nullIndex = i;
              break;
            }
          }

          if (nullIndex !== -1) {
            const keyword = new TextDecoder().decode(data.slice(0, nullIndex));

            // 检查是否是 chara 关键字
            if (keyword === 'chara') {
              const base64Data = new TextDecoder().decode(data.slice(nullIndex + 1));
              // Base64 解码（支持 UTF-8 中文）
              try {
                return this.decodeBase64UTF8(base64Data);
              } catch (e) {
                console.error('Base64 解码失败:', e);
              }
            }
          }
        }

        // 跳过数据和 CRC
        offset += length + 4;

        // 如果是 IEND chunk，结束
        if (type === 'IEND') break;
      }

      return null;
    },

    // Base64 解码（支持 UTF-8 中文）
    decodeBase64UTF8(base64) {
      // 将 Base64 解码为二进制字符串
      const binaryString = atob(base64);
      // 转换为 Uint8Array
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // 使用 TextDecoder 解码 UTF-8
      return new TextDecoder('utf-8').decode(bytes);
    },

    // 应用正则脚本处理文本
    applyRegexScripts(text) {
      if (!text) return text;

      let result = text;

      for (const script of this.regexScripts) {
        if (script.disabled) continue;

        try {
          // 解析正则表达式字符串
          const regexMatch = script.findRegex.match(/^\/(.*)\/([gimsuy]*)$/);
          let regex;

          if (regexMatch) {
            // 格式为 /pattern/flags
            regex = new RegExp(regexMatch[1], regexMatch[2]);
          } else {
            // 直接作为 pattern，默认全局替换
            regex = new RegExp(script.findRegex, 'g');
          }

          result = result.replace(regex, script.replaceString);
        } catch (e) {
          console.error(`正则脚本 "${script.scriptName}" 执行失败:`, e);
        }
      }

      return result;
    },

    // ========== 导出楼层方法 ==========

    openExportRangeDialog() {
      this.exportDialog = {
        show: true,
        startFloor: 1,
        endFloor: this.filteredMessages.length,
        includeName: true,
        includeTime: true
      };
    },

    closeExportDialog() {
      this.exportDialog.show = false;
    },

    // 获取将要导出的消息数量
    getExportCount() {
      const start = Math.max(1, Math.min(this.exportDialog.startFloor, this.filteredMessages.length));
      const end = Math.max(1, Math.min(this.exportDialog.endFloor, this.filteredMessages.length));
      return Math.max(0, end - start + 1);
    },

    // 格式化单条消息用于导出
    formatMessageForExport(message, floorNum) {
      let content = this.getMessageContent(message);

      // 应用标签过滤和正则脚本
      content = this.applyTagFilters(content);
      content = this.applyRegexScripts(content);

      // 移除 HTML 标签，只保留纯文本
      content = this.stripHtmlTags(content);

      let result = '';

      // 添加楼层分隔
      result += `========== 第 ${floorNum} 楼 ==========\n`;

      if (this.exportDialog.includeName) {
        result += `【${message.name}】`;
      }

      if (this.exportDialog.includeTime && message.send_date) {
        if (this.exportDialog.includeName) {
          result += ` `;
        }
        result += `[${message.send_date}]`;
      }

      if (this.exportDialog.includeName || this.exportDialog.includeTime) {
        result += '\n\n';
      }

      result += content;

      return result;
    },

    getExportPreview() {
      const start = Math.max(1, Math.min(this.exportDialog.startFloor, this.filteredMessages.length));
      const end = Math.max(1, Math.min(this.exportDialog.endFloor, this.filteredMessages.length));

      if (start > end || start < 1) return '无效的楼层范围';

      // 预览前 3 条
      const previewCount = Math.min(3, end - start + 1);
      let result = '';

      for (let i = 0; i < previewCount; i++) {
        const floorNum = start + i;
        const message = this.filteredMessages[floorNum - 1];
        if (message) {
          if (i > 0) result += '\n\n';
          result += this.formatMessageForExport(message, floorNum);
        }
      }

      if (end - start + 1 > 3) {
        result += '\n\n...(还有 ' + (end - start + 1 - 3) + ' 条消息)';
      }

      // 限制预览长度
      if (result.length > 800) {
        result = result.substring(0, 800) + '\n...(预览已截断)';
      }

      return result;
    },

    // 移除 HTML 标签，保留纯文本
    stripHtmlTags(html) {
      if (!html) return '';

      // 创建临时 DOM 元素来解析 HTML
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // 获取纯文本
      let text = temp.textContent || temp.innerText || '';

      // 清理多余的空白行
      text = text.replace(/\n{3,}/g, '\n\n');

      return text.trim();
    },

    doExportRange() {
      const start = Math.max(1, Math.min(this.exportDialog.startFloor, this.filteredMessages.length));
      const end = Math.max(1, Math.min(this.exportDialog.endFloor, this.filteredMessages.length));

      if (start > end || start < 1) {
        alert('请输入有效的楼层范围');
        return;
      }

      let result = '';

      for (let i = start; i <= end; i++) {
        const message = this.filteredMessages[i - 1];
        if (message) {
          if (i > start) result += '\n\n\n';
          result += this.formatMessageForExport(message, i);
        }
      }

      // 创建并下载文件
      const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 10);
      const charName = this.metadata.character_name || '聊天记录';
      a.download = `${charName}_楼层${start}-${end}_${timestamp}.txt`;

      a.click();
      URL.revokeObjectURL(url);

      this.closeExportDialog();
    },

    // ========== 样式设置方法 ==========

    toggleStylePanel() {
      this.showStylePanel = !this.showStylePanel;
    },

    loadStylesFromStorage() {
      try {
        const saved = localStorage.getItem('st_reader_text_styles');
        if (saved) {
          const savedStyles = JSON.parse(saved);
          // 合并保存的样式，保留默认值作为后备
          this.textStyles = { ...this.textStyles, ...savedStyles };
        }
      } catch (e) {
        console.error('加载样式设置失败:', e);
      }
    },

    saveStylesToStorage() {
      try {
        localStorage.setItem('st_reader_text_styles', JSON.stringify(this.textStyles));
      } catch (e) {
        console.error('保存样式设置失败:', e);
      }
    },

    // 处理样式变化（在阅读模式下）
    handleStyleChange() {
      this.saveStylesToStorage();
      if (this.readingMode) {
        // 如果在阅读模式，样式改变后需要重新计算页数
        this.handleResize();
      }
    },

    resetStyles() {
      const defaultColor = this.isDarkMode ? '#e0e0e0' : '#1a1a1a';

      this.textStyles = {
        fontFamily: 'system',
        fontSize: 16,
        lineHeight: 1.8,
        paragraphSpacing: 1,
        letterSpacing: 0,
        textColor: defaultColor,      // 使用动态默认色
        italicColor: defaultColor,    // 使用动态默认色
        underlineColor: defaultColor, // 使用动态默认色
        quoteColor: defaultColor,     // 使用动态默认色
        textAlign: 'justify'
      };
      this.saveStylesToStorage();
    },

    setTextColor(color) {
      this.textStyles.textColor = color;
      this.saveStylesToStorage();
    },

    setTextAlign(align) {
      this.textStyles.textAlign = align;
      this.saveStylesToStorage();
    },

    // ========== 自定义字体管理 ==========

    loadCustomFonts() {
      try {
        const saved = localStorage.getItem('st_reader_custom_fonts');
        if (saved) {
          this.customFonts = JSON.parse(saved);
          // 重新注册所有自定义字体
          this.customFonts.forEach(font => {
            this.registerFontFace(font);
          });
        }
      } catch (e) {
        console.error('加载自定义字体失败:', e);
      }
    },

    saveCustomFonts() {
      try {
        localStorage.setItem('st_reader_custom_fonts', JSON.stringify(this.customFonts));
      } catch (e) {
        console.error('保存自定义字体失败:', e);
      }
    },

    registerFontFace(font) {
      const style = document.createElement('style');
      style.id = `custom-font-${font.id}`;
      style.textContent = `
        @font-face {
          font-family: "${font.name}";
          src: url("${font.url}") format("${font.format}");
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `;
      document.head.appendChild(style);
    },

    unregisterFontFace(fontId) {
      const style = document.getElementById(`custom-font-${fontId}`);
      if (style) {
        style.remove();
      }
    },

    async addCustomFont() {
      if (!this.customFontForm.name) {
        alert('请输入字体名称');
        return;
      }

      let fontUrl = '';
      let format = 'truetype';

      if (this.customFontForm.file) {
        // 从文件导入 - 转换为Base64 Data URL
        try {
          fontUrl = await this.fileToDataUrl(this.customFontForm.file);
          format = this.getFontFormat(this.customFontForm.file.name);
        } catch (e) {
          alert('读取字体文件失败: ' + e.message);
          return;
        }
      } else if (this.customFontForm.url) {
        // 从URL导入
        fontUrl = this.customFontForm.url;
        format = this.getFontFormat(this.customFontForm.url);
      } else {
        alert('请选择字体文件或输入字体URL');
        return;
      }

      const fontId = Date.now().toString();
      const newFont = {
        id: fontId,
        name: this.customFontForm.name,
        url: fontUrl,
        format: format
      };

      // 注册字体
      this.registerFontFace(newFont);

      // 添加到列表并保存
      this.customFonts.push(newFont);
      this.saveCustomFonts();

      // 重置表单并关闭对话框
      this.resetCustomFontForm();
      this.showCustomFontDialog = false;

      // 自动选择新添加的字体
      this.textStyles.fontFamily = 'custom-' + fontId;
      this.saveStylesToStorage();
    },

    deleteCustomFont(fontId) {
      if (!confirm('确定要删除这个自定义字体吗？')) return;

      // 如果当前正在使用这个字体，切换回系统默认
      if (this.textStyles.fontFamily === 'custom-' + fontId) {
        this.textStyles.fontFamily = 'system';
        this.saveStylesToStorage();
      }

      // 取消注册字体
      this.unregisterFontFace(fontId);

      // 从列表中移除
      this.customFonts = this.customFonts.filter(f => f.id !== fontId);
      this.saveCustomFonts();
    },

    fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    getFontFormat(filename) {
      const ext = filename.split('.').pop().toLowerCase();
      const formatMap = {
        'ttf': 'truetype',
        'otf': 'opentype',
        'woff': 'woff',
        'woff2': 'woff2'
      };
      return formatMap[ext] || 'truetype';
    },

    handleFontFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.customFontForm.file = file;
        // 如果没有填写名称，使用文件名（去掉扩展名）
        if (!this.customFontForm.name) {
          this.customFontForm.name = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
        }
      }
    },

    resetCustomFontForm() {
      this.customFontForm = {
        name: '',
        url: '',
        file: null
      };
      // 重置文件输入
      const fileInput = this.$refs.fontFileInput;
      if (fileInput) {
        fileInput.value = '';
      }
    },

    getPreviewStyles() {
      return {
        ...this.getContentStyles(), // 直接复用上面的逻辑
        color: 'var(--main-color)'  // 预览框的主颜色
      };
    },

    getContentStyles() {
      return {
        fontFamily: this.getFontFamily(),
        fontSize: this.textStyles.fontSize + 'px',
        lineHeight: this.textStyles.lineHeight,
        textAlign: this.textStyles.textAlign,
        letterSpacing: this.textStyles.letterSpacing + 'px',
        '--main-color': this.textStyles.textColor,
        '--italic-color': this.textStyles.italicColor || this.textStyles.textColor,
        '--underline-color': this.textStyles.underlineColor || this.textStyles.textColor,
        '--quote-color': this.textStyles.quoteColor || '#666666',
        '--paragraph-spacing': this.textStyles.paragraphSpacing + 'em',
        '--content-font': this.getFontFamily()
      };
    },

    getFontFamily() {
      const fontMap = {
        'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        'serif': '"Noto Serif SC", "Source Han Serif SC", "SimSun", "宋体", serif',
        'sans-serif': '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "微软雅黑", sans-serif',
        'kaiti': '"KaiTi", "楷体", "STKaiti", "华文楷体", serif',
        'fangsong': '"FangSong", "仿宋", "STFangsong", "华文仿宋", serif',
        'monospace': '"Consolas", "Monaco", "Source Code Pro", monospace',
        // 在线字体
        'alegreya': '"Alegreya", serif',
        'cangeryunhei': '"仓耳云黑", sans-serif',
        'huiwenmingchao': '"汇文明朝", serif',
        'kongmingchao': '"空明朝", serif',
        'pingxianzhensong': '"屏显臻宋", serif',
        'wenyueminguofangsong': '"文悦民国仿宋", serif'
      };

      // 处理自定义字体
      if (this.textStyles.fontFamily.startsWith('custom-')) {
        const fontId = this.textStyles.fontFamily.replace('custom-', '');
        const customFont = this.customFonts.find(f => f.id === fontId);
        if (customFont) {
          return `"${customFont.name}", sans-serif`;
        }
      }

      return fontMap[this.textStyles.fontFamily] || fontMap['system'];
    },

    // ========== 阅读模式方法（全新实现：CSS Columns） ==========

    toggleReadingMode() {
      this.readingMode = !this.readingMode;
      
      if (this.readingMode) {
        // 进入阅读模式
        this.toolbarVisible = false;
        // ... (隐藏其他面板的代码保持不变) ...
        this.showSearchBar = false;
        this.showRegexManager = false;
        this.showTagFilterManager = false;
        this.showFavoritesPanel = false;
        this.showStylePanel = false;
        this.selectionMenu.show = false;
        
        this.readingCurrentPage = 1;
        document.body.style.overflow = 'hidden';

        this.generateReadingContent();
        
        // 监听窗口大小调整
        window.addEventListener('resize', this.handleResize);

        // 启动 ResizeObserver 监听内容变化
        this.$nextTick(() => {
          if (this.$refs.readingContentEl) {
            this.resizeObserver = new ResizeObserver(() => {
              window.requestAnimationFrame(() => {
                this.calculateTotalPages();
              });
            });
            this.resizeObserver.observe(this.$refs.readingContentEl);
          }
        });

      } else {
        // 退出阅读模式
        document.body.style.overflow = '';
        this.toolbarVisible = false;
        window.removeEventListener('resize', this.handleResize);
        
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver = null;
        }
      }
    },

    generateReadingContent() {
      let fullContent = '';

      // 【修改点1】只获取当前分页的数据 (比如 10 条)，而不是全部数据
      // 这样 DOM 节点数瞬间减少 90%以上，解决卡顿
      const messagesToRender = this.paginatedMessages;

      // 计算当前页的起始楼层号 (用于 data-floor)
      const startFloorIndex = (this.currentPage - 1) * this.pageSize;

      for (let i = 0; i < messagesToRender.length; i++) {
        const message = messagesToRender[i];

        // 这里的 i 是当前页的索引，messageIndex 是全局索引
        // 传递给 renderContent 的应该是全局索引，用于匹配高亮
        const globalIndex = startFloorIndex + i;

        let content = this.getMessageContent(message);
        content = this.renderContent(content, globalIndex);

        if (i > 0) {
          fullContent += '<div class="reading-separator"></div>';
        }

        // data-floor 对应全局楼层索引
        fullContent += `<div class="reading-message" data-floor="${globalIndex}">`;

        if (message.name) {
          fullContent += `<p class="reading-speaker-name">【${message.name}】</p>`;
        }

        fullContent += content;
        fullContent += '</div>';
      }

      // 保存当前阅读进度（横向页码）
      // 注意：这里重置为 1，因为每次加载新数据，都应该从第一屏开始看
      // 除非是点“上一页”回来的（这个逻辑稍复杂，暂时先默认重置到开头）
      if (!this.keepReadingPagePosition) {
        this.readingCurrentPage = 1;
      }
      this.keepReadingPagePosition = false; // 用完即焚标记

      this.readingFullHtml = fullContent;

      this.$nextTick(() => {
        const contentEl = this.$refs.readingContentEl;
        if (contentEl) {
          contentEl.style.width = '';
        }
        this.updateColumnWidth();
        this.$nextTick(() => {
          setTimeout(() => {
            this.calculateTotalPages();
          }, 50);
        });
      });
    },

    updateColumnWidth() {
      const contentEl = this.$refs.readingContentEl;
      if (contentEl) {
        contentEl.style.columnWidth = `${window.innerWidth}px`;
      }
    },

    // SillyTavern我草饲你
    parseSTDate(dateInput) {
      if (!dateInput) return null;

      // 1. 如果已经是数字时间戳，直接返回
      if (typeof dateInput === 'number') return new Date(dateInput);

      let dateStr = String(dateInput).trim();

      // 2. 处理格式： "2025-12-29@01h50m41s"
      // 目标转换： "2025-12-29T01:50:41" (标准 ISO 格式)
      if (dateStr.includes('@')) {
        try {
          // 将 @ 替换为 T，将 h, m 替换为 :，去掉 s
          const isoStr = dateStr
            .replace('@', 'T')
            .replace('h', ':')
            .replace('m', ':')
            .replace('s', '');
          const d = new Date(isoStr);
          if (!isNaN(d.getTime())) return d;
        } catch (e) {
          console.warn('解析 @ 格式日期失败:', dateStr);
        }
      }

      // 3. 处理格式： "December 29, 2025 1:50am"
      // 部分浏览器（如 Safari）可能不喜欢 am/pm 前面没空格，或者不喜欢英文月份
      // 我们先尝试直接解析
      let d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;

      // 4. 如果失败，尝试手动给 am/pm 加空格 "1:50am" -> "1:50 am"
      if (/am|pm/i.test(dateStr) && !/\s(am|pm)/i.test(dateStr)) {
        const fixedStr = dateStr.replace(/(\d)(am|pm)/i, '$1 $2');
        d = new Date(fixedStr);
        if (!isNaN(d.getTime())) return d;
      }

      // 5. 实在解析不了，返回 null
      return null;
    },

    calculateTotalPages() {
      const contentEl = this.$refs.readingContentEl;
      if (!contentEl) return;

      const pageWidth = window.innerWidth; // 视窗宽度（一页的宽度）
      const contentWidth = contentEl.scrollWidth; // 内容实际总宽度
      const currentElWidth = contentEl.offsetWidth; // 元素当前宽度
      
      // 检查容器宽度是否被内容撑开
      if (contentWidth > currentElWidth) {
        contentEl.style.width = `${contentWidth}px`;
      }

      this.windowWidth = pageWidth;

      const calculatedPages = Math.max(1, Math.ceil((contentWidth - 20) / pageWidth));

      const fixedWidth = calculatedPages * pageWidth;
      contentEl.style.width = `${fixedWidth}px`;
      this.readingTotalPages = calculatedPages;
      
      if (this.readingCurrentPage > this.readingTotalPages) {
        this.readingCurrentPage = this.readingTotalPages;
      }
      console.groupEnd();
    },

    handleResize() {
      // 防抖
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        const contentEl = this.$refs.readingContentEl;
        if (contentEl) {
          // 重置宽度为 auto，让 CSS columns 重新布局
          contentEl.style.width = '';
        }
        this.updateColumnWidth();
        this.$nextTick(() => {
          setTimeout(() => {
            this.calculateTotalPages();
          }, 50);
        });
      }, 100);
    },

    getReadingTransform() {
      // 通过 translateX 移动整个长条内容
      const offset = (this.readingCurrentPage - 1) * this.windowWidth;

      return {
        transform: `translateX(-${offset}px)`,
        // 合并字体样式
        ...this.getContentStyles()
      };
    },

    getReadingFloorRange() {
      // 显示：当前页数/总页数 (楼层范围)
      // 例如： 3 / 5 页 (11-20楼)
      const start = (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, this.filteredMessages.length);

      return `${start}-${end} 楼`;
    },

    readingPrevPage() {
      // 情况1：当前这批数据还能往回翻
      if (this.readingCurrentPage > 1) {
        this.readingCurrentPage--;
      }
      // 情况2：到头了，检查有没有上一批数据
      else if (this.currentPage > 1) {
        // 进入上一页数据
        this.currentPage--;

        // 【体验优化】从上一批数据回来时，应该直接跳到“最后一屏”
        // 这样符合“往回翻书”的直觉
        // 我们设置一个标记，在 generateReadingContent 里处理
        this.keepReadingPagePosition = true;

        // 先生成内容
        this.generateReadingContent();

        // 等生成完了，计算出总页数，再跳到最后一页
        this.$nextTick(() => {
          // 需要多等一会，因为 generateReadingContent 里面也有 nextTick 和 setTimeout
          setTimeout(() => {
            this.readingCurrentPage = this.readingTotalPages;
          }, 100); // 这里的延时要比 generateReadingContent 里的略长
        });
      }
    },

    readingNextPage() {
      // 情况1：当前这批数据的“视觉页”还没翻完
      if (this.readingCurrentPage < this.readingTotalPages) {
        this.readingCurrentPage++;
      }
      // 情况2：当前这批看完了，检查还有没有下一批数据（普通分页）
      else if (this.currentPage < this.totalPages) {
        // 进入下一页数据
        this.currentPage++;
        // 重新生成阅读内容
        this.generateReadingContent();
      }
      // 情况3：全看完了，到底了
      else {
        // 可以加个提示，或者什么都不做
      }
    },

    // 交互逻辑
    handleReadingClick(e) {
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        return;
      }

      // 2. 获取屏幕宽度和点击坐标
      const { clientX } = e;
      const { innerWidth } = window;

      const leftZone = innerWidth * 0.25;
      const rightZone = innerWidth * 0.75;

      if (clientX < leftZone) {
        // --- 点击左侧：上一页 ---
        this.readingPrevPage();
      } else if (clientX > rightZone) {
        // --- 点击右侧：下一页 ---
        this.readingNextPage();
      } else {
        // --- 点击中间：切换菜单显示/隐藏 ---
        this.showReadingMenu = !this.showReadingMenu;
      }
    },

    onReadingTouchStart(e) {
      this.readingTouchStartX = e.touches[0].clientX;
      this.readingTouchStartY = e.touches[0].clientY;
    },

    onReadingTouchEnd(e) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - this.readingTouchStartX;
      const deltaY = touchEndY - this.readingTouchStartY;

      // 判定为滑动的阈值
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.readingPrevPage();
        } else {
          this.readingNextPage();
        }
      }
    },

    // 阅读模式下的文本选择处理
    onReadingMouseUp(event) {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText.length > 0) {
        // 找到选中文本所属的消息索引
        let messageIndex = null;
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        // 尝试从父元素获取 data-floor 属性（查找 .reading-message 容器）
        let el = container.nodeType === 3 ? container.parentElement : container;
        while (el && el !== document.body) {
          if (el.classList && el.classList.contains('reading-message') && el.hasAttribute('data-floor')) {
            messageIndex = parseInt(el.getAttribute('data-floor'));
            break;
          }
          el = el.parentElement;
        }

        // 显示选择菜单
        this.selectionMenu = {
          show: true,
          x: event.clientX,
          y: event.clientY - 40,
          text: selectedText,
          messageIndex: messageIndex,
          speaker: messageIndex !== null && this.filteredMessages[messageIndex]
            ? this.filteredMessages[messageIndex].name
            : ''
        };
      }
    },

    toggleToolbar() {
      this.toolbarVisible = !this.toolbarVisible;

      if (this.toolbarVisible) {
        if (this.toolbarTimeout) clearTimeout(this.toolbarTimeout);
        this.toolbarTimeout = setTimeout(() => {
          this.toolbarVisible = false;
        }, 3000);
      }
    },

    handleKeydown(e) {
      // 只有在阅读模式下，按 ESC 才触发
      if (this.readingMode && e.key === 'Escape') {
        this.toggleReadingMode();
      }

      if (this.readingMode) {
        if (e.key === 'ArrowLeft') {
          this.readingPrevPage();
        } else if (e.key === 'ArrowRight') {
          this.readingNextPage();
        }
      }
    },

    openIntimacyModal() {
      this.calculateIntimacyStats();
      this.showIntimacyModal = true;
    },

    calculateIntimacyStats() {
      if (!this.messages.length) return;
      const validMessages = this.messages.filter(m => m.send_date);
      if (!validMessages.length) return;

      // 1. 排序
      const sortedMsgs = [...validMessages].sort((a, b) => {
        const tA = this.parseSTDate(a.send_date)?.getTime() || 0;
        const tB = this.parseSTDate(b.send_date)?.getTime() || 0;
        return tA - tB;
      });

      let totalChars = 0;
      let totalRerolls = 0;

      // 2. 统计每天的数据
      const dayMap = new Map(); // Key: dateStr, Value: { count, chars }

      sortedMsgs.forEach(msg => {
        const content = this.getMessageContent(msg);
        const msgLen = content ? content.length : 0;

        if (content) totalChars += msgLen;
        if (msg.swipes && msg.swipes.length > 1) totalRerolls += (msg.swipes.length - 1);

        const date = this.parseSTDate(msg.send_date);
        if (date) {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;

          if (!dayMap.has(dateStr)) {
            dayMap.set(dateStr, { count: 0, chars: 0 });
          }
          const dayData = dayMap.get(dateStr);
          dayData.count += 1;
          dayData.chars += msgLen;
        }
      });

      // 3. 生成日历数据
      const firstDateObj = this.parseSTDate(sortedMsgs[0].send_date);
      const lastDateObj = this.parseSTDate(sortedMsgs[sortedMsgs.length - 1].send_date) || new Date();

      if (firstDateObj) {
        this.intimacyData.firstDate = firstDateObj.toLocaleDateString();
        const now = new Date();
        this.intimacyData.daysSince = Math.floor((now - firstDateObj) / (24 * 3600 * 1000));

        const monthsData = [];
        let currentYear = firstDateObj.getFullYear();
        let currentMonth = firstDateObj.getMonth();

        const endYear = lastDateObj.getFullYear();
        const endMonth = lastDateObj.getMonth();

        // --- 循环开始 (只写这一遍) ---
        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const firstDayObj = new Date(currentYear, currentMonth, 1);
          const paddingStart = firstDayObj.getDay(); // 0-6

          const days = [];

          // 当月统计变量
          let monthTotalCount = 0;
          let monthTotalChars = 0;

          for (let d = 1; d <= daysInMonth; d++) {
            const mStr = String(currentMonth + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const dateStr = `${currentYear}-${mStr}-${dStr}`;

            const data = dayMap.get(dateStr) || { count: 0, chars: 0 };
            const count = data.count;
            const chars = data.chars;

            // 累加当月数据
            monthTotalCount += count;
            monthTotalChars += chars;

            let level = 0;
            if (count > 0) level = 1;
            if (count > 20) level = 2;
            if (count > 50) level = 3;
            if (count > 100) level = 4;

            days.push({
              dayNum: d,
              dateStr: dateStr,
              count: count,
              chars: chars,
              level: level
            });
          }

          // 将由于上面计算好的月份数据推入数组
          monthsData.push({
            year: currentYear,
            month: currentMonth + 1,
            paddingStart: paddingStart, // 这里使用了 paddingStart
            days: days,
            totalCount: monthTotalCount,
            totalChars: monthTotalChars
          });

          // 下个月
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
        }
        // --- 循环结束 ---

        this.intimacyData.calendarMonths = monthsData.reverse();
        this.currentMonthIndex = 0;
      } else {
        this.intimacyData.calendarMonths = [];
      }

      this.intimacyData.activeDays = dayMap.size;
      this.intimacyData.totalMessages = this.messages.length;
      this.intimacyData.totalChars = totalChars;
      this.intimacyData.totalRerolls = totalRerolls;
    },

    showDayTooltip(e, day) {
      if (day.count === 0) return; // 没有数据就不显示
      this.tooltip.show = true;
      this.tooltip.dateStr = day.dateStr;
      this.tooltip.count = day.count;
      this.tooltip.chars = day.chars;
      this.updateTooltipPos(e);
    },

    // 移动提示框 (跟随鼠标)
    moveDayTooltip(e) {
      if (!this.tooltip.show) return;
      this.updateTooltipPos(e);
    },

    // 隐藏提示框
    hideDayTooltip() {
      this.tooltip.show = false;
    },

    // 计算位置 (避免溢出屏幕)
    updateTooltipPos(e) {
      const offset = 15; // 距离鼠标的偏移量
      this.tooltip.x = e.clientX + offset;
      this.tooltip.y = e.clientY + offset;
    },
    // === 切换月份 ===
    prevMonth() {
      // 检查边界
      if (this.currentMonthIndex < this.intimacyData.calendarMonths.length - 1) {
        this.currentMonthIndex++;
      }
    },
    nextMonth() {
      if (this.currentMonthIndex > 0) {
        this.currentMonthIndex--;
      }
    },
  }
}

</script>

<style scoped>
.st-reader {
  min-height: 100vh;
  background-color: #fafafa;
  background-image: url('https://sazankaze.neocities.org/bg_pic/whitish-grain-wall-template.jpg');
  background-repeat: repeat;
  background-attachment: fixed;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* 上传区域 */
.upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

.upload-container {
  width: 100%;
  max-width: 400px;
}

.file-input {
  display: none;
}

.upload-label {
  display: block;
  padding: 4rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #000;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.upload-label:hover {
  background: #000;
  color: #fff;
}

.upload-text {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.upload-hint {
  font-size: 0.875rem;
  opacity: 0.6;
}

.upload-label:hover .upload-hint {
  opacity: 1;
}

/* 聊天容器 */
.chat-container {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.85);
  min-height: 100vh;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
}

/* 头部 */
.chat-header {
  padding: 3rem 3rem 2rem;
  border-bottom: 2px solid #000;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-content {
  flex: 1;
}

.chat-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.02em;
  text-align: left;
}

.chat-meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #666;
}

.message-count {
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 420px;
}

.action-button,
.reset-button {
  padding: 0.25rem 0.5rem;
  background: #fff;
  border: 1px solid #000;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.action-button:hover,
.reset-button:hover {
  background: #000;
  color: #fff;
}

.regex-button {
  background: #f5f5f5;
}

.search-toggle.active {
  background: #000;
  color: #fff;
}

/* 搜索栏 */
.search-bar {
  padding: 1rem 3rem;
  background: #f9f9f9;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  max-width: 500px;
}

.search-input {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 1rem;
  font-size: 0.9375rem;
  border: 1px solid #ddd;
  background: #fff;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #000;
}

.search-input::placeholder {
  color: #999;
}

.search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  color: #000;
}

.search-info {
  font-size: 0.875rem;
  color: #666;
  white-space: nowrap;
}

.filter-hint {
  color: #999;
  font-size: 0.75rem;
}

/* 搜索高亮 */
:deep(.search-highlight) {
  background: #ffeb3b;
  color: #000;
  padding: 0 0.125rem;
}

/* 正则脚本管理面板 */
.regex-manager {
  border-bottom: 2px solid #000;
  background: #fafafa;
  padding: 1.5rem 3rem;
}

.regex-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.regex-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.regex-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #000;
  transition: all 0.2s;
}

.btn-primary {
  background: #000;
  color: #fff;
}

.btn-primary:hover {
  background: #333;
}

.btn-secondary {
  background: #fff;
  color: #000;
}

.btn-secondary:hover {
  background: #f0f0f0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 脚本编辑表单 */
.script-form {
  background: #fff;
  border: 1px solid #ddd;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-of-type {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
}

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #ccc;
  font-family: 'Consolas', 'Monaco', monospace;
}

.form-group textarea {
  resize: vertical;
}

.form-select {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
}

.form-hint {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
}

.form-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

/* 脚本列表 */
.script-list {
  max-height: 400px;
  overflow-y: auto;
}

.no-scripts {
  padding: 2rem;
  text-align: center;
  color: #666;
  font-size: 0.875rem;
}

.script-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #fff;
  border: 1px solid #ddd;
  margin-bottom: 0.5rem;
  cursor: grab;
  transition: all 0.2s;
}

.script-item:hover {
  border-color: #000;
}

.script-item.disabled {
  opacity: 0.5;
  background: #f5f5f5;
}

.script-item.dragging {
  opacity: 0.5;
  border-style: dashed;
}

.script-drag-handle {
  color: #999;
  font-size: 1rem;
  cursor: grab;
  user-select: none;
}

.script-info {
  flex: 1;
  min-width: 0;
}

.script-name {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.script-regex {
  font-size: 0.75rem;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.script-controls {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-icon {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  border-color: #000;
  background: #f0f0f0;
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-icon.btn-danger:hover:not(:disabled) {
  background: #ff4444;
  color: #fff;
  border-color: #ff4444;
}

.btn-toggle {
  padding: 0.125rem 0.375rem;
  font-size: 0.65rem;
  font-weight: 500;
  border: 1px solid #ddd;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 50px;
}

.btn-toggle.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

/* 分页控件 */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 3rem;
  background: rgba(255, 255, 255, 0.95);
  border-top: 2px solid #000;
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 800px;
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.pagination-info {
  font-size: 0.875rem;
  color: #666;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #000;
  background: #f0f0f0;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0 0.75rem;
  min-width: 80px;
  text-align: center;
}

.page-size-select {
  padding: 0.375rem 0.5rem;
  border: 1px solid #ddd;
  background: #fff;
  font-size: 0.875rem;
  cursor: pointer;
  margin-left: 0.5rem;
}

.page-size-select:hover {
  border-color: #000;
}

/* 消息列表 */
.messages-wrapper {
  padding: 0;
  padding-bottom: 80px;
  /* 为固定的分页控件留出空间 */
}

.message-block {
  padding: 2.5rem 3rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: transparent;
}

.message-block:last-child {
  border-bottom: none;
}

/* 用户消息 - 深灰背景，左侧黑色粗边框 */
.user-message {
  background: rgba(0, 0, 0, 0.06) !important;
  border-left: 6px solid #000 !important;
}

.user-message .speaker-name {
  font-weight: 800;
  color: #000;
}

/* AI/角色消息 - 透明背景 */
.message-block:not(.user-message) {
  background: transparent;
}

.message-block:not(.user-message) .speaker-name {
  color: #333;
}

/* 消息头部 */
.message-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1rem;
}

.speaker-name {
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.timestamp {
  font-size: 0.75rem;
  color: #999;
  font-variant-numeric: tabular-nums;
}

.model-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #000;
  color: #fff;
  font-weight: 500;
}

/* 消息内容 */
.message-content {
  font-size: 1rem;
  line-height: 1.8;
  color: #1a1a1a;
  text-align: justify;
}

/* 确保所有文本子元素使用指定字体 */
.message-content :deep(p),
.message-content :deep(span),
.message-content :deep(strong),
.message-content :deep(em),
.message-content :deep(blockquote),
.message-content :deep(li),
.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4),
.message-content :deep(h5),
.message-content :deep(h6),
.message-content :deep(a),
.message-content :deep(td),
.message-content :deep(th) {
  font-family: var(--content-font);
}

/* 代码元素使用等宽字体 */
.message-content :deep(code),
.message-content :deep(pre),
.message-content :deep(pre code) {
  font-family: 'Consolas', 'Monaco', monospace !important;
}

/* 修改 .message-content 的颜色定义 */
.message-content {
  font-size: 1rem;
  line-height: 1.8;
  /* 使用变量，如果变量不存在则回退到 #1a1a1a */
  color: var(--main-color, #1a1a1a);
  text-align: justify;
}

/* === 新增以下具体的样式规则 === */

/* 斜体文本 */
.message-content :deep(em),
.message-content :deep(i) {
  font-style: italic;
  color: var(--italic-color, inherit);
  /* 使用斜体变量 */
}

/* 下划线文本 (Markdown通常不支持下划线，但如果有 <u> 标签) */
.message-content :deep(u) {
  text-decoration: underline;
  color: var(--underline-color, inherit);
  /* 使用下划线变量 */
}

/* 引用文本 */
.message-content :deep(blockquote) {
  border-left: 3px solid var(--quote-color, #666);
  /* 边框也跟着变色 */
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--quote-color, #666);
  /* 使用引用变量 */
}

/* 同样规则应用到阅读模式 */
.reading-content :deep(em),
.reading-content :deep(i) {
  color: var(--italic-color, inherit);
}

.reading-content :deep(u) {
  color: var(--underline-color, inherit);
}

.reading-content :deep(blockquote) {
  color: var(--quote-color, #666);
  border-left-color: var(--quote-color, #666);
}

/* HTML 文档预览 */
.message-content-html {
  font-size: 1rem;
  line-height: 1.8;
  color: #1a1a1a;
}

.html-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.html-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #000;
  color: #fff;
  font-weight: 500;
}

.preview-toggle {
  padding: 0.25rem 0.75rem;
  background: #fff;
  border: 1px solid #000;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.preview-toggle:hover {
  background: #000;
  color: #fff;
}

.message-content-mixed {
  font-size: 1rem;
  line-height: 1.8;
  color: #1a1a1a;
}

/* 确保混合内容的文本子元素使用指定字体 */
.message-content-mixed :deep(p),
.message-content-mixed :deep(span),
.message-content-mixed :deep(strong),
.message-content-mixed :deep(em),
.message-content-mixed :deep(blockquote),
.message-content-mixed :deep(li),
.message-content-mixed :deep(h1),
.message-content-mixed :deep(h2),
.message-content-mixed :deep(h3),
.message-content-mixed :deep(h4),
.message-content-mixed :deep(a),
.message-content-mixed :deep(td),
.message-content-mixed :deep(th) {
  font-family: var(--content-font);
}

.message-content-mixed :deep(code),
.message-content-mixed :deep(pre),
.message-content-mixed :deep(pre code) {
  font-family: 'Consolas', 'Monaco', monospace !important;
}

.html-preview-section {
  margin-bottom: 1.5rem;
}

.html-iframe {
  width: 100%;
  min-height: 400px;
  border: 1px solid #e0e0e0;
  background: #fff;
}

.html-code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  background: #f5f5f5;
  padding: 1rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  border: 1px solid #e0e0e0;
  margin: 0;
  line-height: 1.5;
  color: #333;
}

.message-content :deep(p) {
  margin: 0 0 var(--paragraph-spacing, 1em) 0;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(strong) {
  font-weight: 700;
}

.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(code) {
  font-family: 'Consolas', 'Monaco', monospace;
  background: #f0f0f0;
  padding: 0.125rem 0.375rem;
  font-size: 0.9em;
}

.message-content :deep(pre) {
  background: #f0f0f0;
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.message-content :deep(pre code) {
  background: none;
  padding: 0;
}

.message-content :deep(blockquote) {
  border-left: 3px solid #000;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #666;
}

.message-content :deep(a) {
  color: #000;
  text-decoration: underline;
}

.message-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1rem 0;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  font-weight: 700;
  margin: 1.5rem 0 0.75rem 0;
  line-height: 1.3;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.message-content :deep(li) {
  margin: 0.25rem 0;
}

/* Swipe 切换控件 */
.swipe-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed #ddd;
}

.swipe-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border-radius: 50%;
}

.swipe-btn:hover:not(:disabled) {
  border-color: #000;
  background: #f0f0f0;
}

.swipe-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.swipe-indicator {
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  min-width: 60px;
  text-align: center;
}

/* 编辑按钮 */
.edit-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0px;
  transition: all 0.2s;
  opacity: 0.6;
}

.edit-btn:hover {
  opacity: 1;
  border-color: #000;
  background: #f0f0f0;
}

/* 编辑表单 */
.message-edit-form {
  margin-top: 1rem;
}

.edit-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-family: 'Consolas', 'Monaco', monospace;
  border: 1px solid #ddd;
  background: #fafafa;
  resize: vertical;
  line-height: 1.6;
  min-height: 200px;
}

.edit-textarea:focus {
  outline: none;
  border-color: #000;
  background: #fff;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

/* 收藏按钮高亮 */
.edit-btn.favorited {
  color: #f5a623;
  border-color: #f5a623;
  opacity: 1;
}

/* 收藏夹面板 */
.favorites-list {
  max-height: 500px;
}

.favorite-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #fff;
  border: 1px solid #ddd;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.favorite-item:hover {
  border-color: #000;
  background: #f9f9f9;
}

.favorite-content {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.favorite-type {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.favorite-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: #333;
  word-break: break-word;
  text-align: left;
}

.favorite-meta {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
}

.favorite-actions {
  display: flex;
  gap: 0.25rem;
}

/* 文本选择菜单 */
.selection-menu {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid #000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  gap: 0;
}

.selection-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: #fff;
  cursor: pointer;
  font-size: 0.7rem;
  white-space: nowrap;
  transition: all 0.2s;
}

.selection-btn:hover {
  background: #000;
  color: #fff;
}

.selection-btn:not(:last-child) {
  border-right: 1px solid #ddd;
}

/* 用户划线高亮 */
:deep(.user-highlight) {
  text-decoration: none;
  background-image: linear-gradient(to right, #87ceeb 60%, transparent 40%);
  background-position: 0 100%;
  background-size: 10px 1.5px;
  background-repeat: repeat-x;
  padding-bottom: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.user-highlight:hover) {
  background-color: rgba(135, 206, 235, 0.2);
}

/* 高亮取消菜单 */
.highlight-menu {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid #000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

/* 楼层高亮闪烁效果 */
@keyframes highlight-flash {

  0%,
  100% {
    background-color: inherit;
  }

  25%,
  75% {
    background-color: rgba(255, 235, 59, 0.3);
  }

  50% {
    background-color: rgba(255, 235, 59, 0.5);
  }
}

.message-block.highlight-flash {
  animation: highlight-flash 2s ease-in-out;
}

/* 划线列表样式 */
.highlights-list {
  max-height: 300px;
}

.highlight-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #eee;
  gap: 0.5rem;
}

.highlight-item:last-child {
  border-bottom: none;
}

.highlight-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.highlight-text-preview {
  font-size: 0.85rem;
  color: #333;
  word-break: break-word;
  border-bottom: 2px dashed #87ceeb;
  display: inline;
}

.highlight-meta {
  font-size: 0.75rem;
  color: #888;
}

/* 导出对话框 */
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-dialog {
  background: #fff;
  border: 2px solid #000;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.export-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd;
}

.export-dialog-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.export-dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  cursor: pointer;
}

.export-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.export-preview {
  background: #f9f9f9;
  border: 1px solid #ddd;
  padding: 1rem;
}

.export-preview-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.5rem;
}

.export-preview-content {
  font-size: 0.875rem;
  line-height: 1.6;
  font-family: 'Consolas', 'Monaco', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  color: #333;
}

.export-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #ddd;
  background: #fafafa;
}

/* 导出范围输入 */
.export-range {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.range-inputs {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

.range-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.range-input-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.range-input {
  width: 100px;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  text-align: center;
  font-weight: 600;
}

.range-input:focus {
  outline: none;
  border-color: #000;
}

.range-separator {
  font-size: 1rem;
  color: #666;
  padding-bottom: 0.5rem;
}

.range-hint {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #666;
}

/* 样式设置面板 */
.style-panel {
  background: #fafafa;
}

.style-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
}

.style-divider {
  border: 0;
  border-top: 1px dashed #eee;
  margin: 0.25rem 0;
  width: 100%;
}

.style-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.style-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.25rem;
  display: flex;
  justify-content: space-between;
}

.style-flex-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.style-select {
  padding: 0 0.75rem;
  height: 34px;
  width: 180px;
  font-size: 0.85rem;
  border: 1px solid #ddd;
  background-color: #fff;
  border-radius: 0px;
  cursor: pointer;
  outline: none;
  color: #333;
  transition: all 0.2s;
}

.style-select:hover {
  border-color: #999;
}

.style-select:focus {
  outline: none;
  border-color: #000;
}

.compact-btn {
  white-space: nowrap;
  height: 34px;
  line-height: 1;
  display: flex;
  align-items: center;
}

.compact-group {
  margin: 0;
  /* 移除单独 group 的 margin */
}

.sliders-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.5rem;
  margin-bottom: 0.5rem;
}

.style-slider.full-width {
  width: 100%;
  /* 滑块占满一行 */
  margin: 0;
  max-width: none;
}

/* 颜色区域 Grid 布局 (核心修改) */
.color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 两列等宽 */
  gap: 1rem 1.5rem;
  /* 行间距1rem，列间距1.5rem */
}

.style-slider {
  -webkit-appearance: none;
  /* 清除默认样式 */
  appearance: none;
  width: 100%;
  height: 4px;
  /* 【改动】轨道变细为 4px */
  background: #e0e0e0;
  border-radius: 0px;
  outline: none;
  cursor: pointer;
  margin: 8px 0;
  /* 给上下留点点击空间 */
}

.style-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  /* 圆钮大小 */
  height: 16px;
  background: #fff;
  border: 2px solid #333;
  /* 深色边框 */
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s, background 0.1s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  /* 加一点投影增加立体感 */
}


.style-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  /* 悬停微放大 */
  background: #333;
  /* 悬停变黑 */
  border-color: #333;
}

/* 滑块的圆钮 (Firefox) */
.style-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2px solid #333;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.style-slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  background: #333;
}

.style-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  min-width: 50px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.color-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-btn {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #000;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000;
}

/* 颜色选择器微调 */
.color-picker-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 2px;
  border: 1px solid #eee;
}

.color-input {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 2px;
  padding: 0;
  background: none;
}

.color-value {
  font-size: 0.75rem;
  font-family: monospace;
  color: #999;
}

.align-options {
  display: flex;
  gap: 0.5rem;
}

.align-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.align-btn:hover {
  border-color: #000;
  background: #f5f5f5;
}

.align-btn.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.style-preview {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #ddd;
}

.style-preview-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.75rem;
}

.style-preview-content {
  padding: 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* 自定义字体管理 */
.custom-fonts-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
}

.custom-font-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.custom-font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.custom-font-name {
  font-size: 0.875rem;
  color: #333;
}

.add-font-btn {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* 模态对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-dialog {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  line-height: 1;
}

.modal-close:hover {
  color: #000;
}

.modal-body {
  padding: 1.25rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #eee;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #666;
}

.form-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.form-file-input {
  width: 100%;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.file-selected {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #666;
}

.required {
  color: #e53935;
}

.import-tabs {
  margin-top: 1rem;
}

.import-method {
  margin-bottom: 1rem;
}

.import-method-header {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
}

.import-divider {
  text-align: center;
  color: #999;
  font-size: 0.875rem;
  margin: 1rem 0;
  position: relative;
}

.import-divider::before,
.import-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #ddd;
}

.import-divider::before {
  left: 0;
}

.import-divider::after {
  right: 0;
}

.btn-sm {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
}

/* 激活状态的按钮 */
.action-button.active {
  background: #000;
  color: #fff;
}

/* 阅读模式按钮 */
.reading-mode-btn {
  background: #f0f7ff;
  border-color: #4a90d9;
  color: #4a90d9;
}

.reading-mode-btn:hover {
  background: #4a90d9;
  color: #fff;
}

.reading-mode-btn.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

/* ======= 阅读模式视图 ======= */
/* 核心容器：覆盖全屏，隐藏溢出 */
.reading-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fefefe;
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 隐藏浏览器原生滚动条 */
}

/* 内容长条：利用 CSS Columns 分页 */
.reading-content {
  height: calc(100vh - 3rem);
  /* 固定高度，留出底部控制栏空间 */
  /* width 由 JS 动态设置为 scrollWidth */
  min-width: 100vw;
  /* 初始最小宽度为视窗宽度 */
  box-sizing: border-box;

  /* CSS Columns 核心设置 - column-width 由 JS 动态设置 */
  column-gap: 0;
  /* 列间距为0，padding在列内部 */
  column-fill: auto;
  /* 内容先填满一列（高度），再填下一列 */

  /* 无外部padding，padding在列内部通过内容样式处理 */
  padding: 2rem 0 3rem 0;

  text-align: justify;
  overflow: visible;
  /* 允许溢出，scrollWidth 才能正确计算 */

  /* 翻页动画 */
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* 断行优化 */
  word-wrap: break-word;
  word-break: break-all;

  /* 允许文本选择（用于划线功能） */
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

/* 确保阅读模式所有文本子元素使用指定字体 */
.reading-content :deep(p),
.reading-content :deep(span),
.reading-content :deep(strong),
.reading-content :deep(em),
.reading-content :deep(blockquote),
.reading-content :deep(li),
.reading-content :deep(h1),
.reading-content :deep(h2),
.reading-content :deep(h3),
.reading-content :deep(h4),
.reading-content :deep(h5),
.reading-content :deep(h6),
.reading-content :deep(a),
.reading-content :deep(td),
.reading-content :deep(th) {
  font-family: var(--content-font);
}

.reading-content :deep(code),
.reading-content :deep(pre),
.reading-content :deep(pre code) {
  font-family: 'Consolas', 'Monaco', monospace !important;
}

/* 所有内容元素添加水平内边距 */
.reading-content :deep(p),
.reading-content :deep(div),
.reading-content :deep(li),
.reading-content :deep(h1),
.reading-content :deep(h2),
.reading-content :deep(h3),
.reading-content :deep(h4),
.reading-content :deep(h5),
.reading-content :deep(h6),
.reading-content :deep(blockquote),
.reading-content :deep(pre) {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  box-sizing: border-box;
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 0 var(--paragraph-spacing, 1em) 0;
}

/* 消息容器 */
.reading-content :deep(.reading-message) {
  display: block;
}

/* 名字样式 */
.reading-content :deep(.reading-speaker-name) {
  font-weight: bold;
  font-size: 0.9em;
  color: #666;
  margin-top: 1rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.reading-content :deep(img) {
  max-width: calc(100% - 3rem);
  max-height: 90%;
  height: auto;
  display: block;
  margin: 1rem auto;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  box-sizing: border-box;
}

/* 分隔符 */
.reading-content :deep(.reading-separator) {
  height: 2rem;
  margin: 1rem 1.5rem;
  border-bottom: 1px dashed #eee;
}

/* 翻页热区 - 左侧 */
.reading-nav-left {
  position: fixed;
  top: 0;
  left: 0;
  width: 20%;
  height: calc(100% - 60px);
  z-index: 504;
  cursor: w-resize;
  -webkit-tap-highlight-color: transparent;
}

/* 翻页热区 - 右侧 */
.reading-nav-right {
  position: fixed;
  top: 0;
  right: 0;
  width: 20%;
  height: calc(100% - 60px);
  z-index: 504;
  cursor: e-resize;
  -webkit-tap-highlight-color: transparent;
}

/* 工具栏触发区 - 中间顶部 */
.reading-nav-center {
  position: fixed;
  top: 0;
  left: 20%;
  width: 60%;
  height: 60px;
  z-index: 504;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* 阅读模式底部控制栏 */
.reading-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  border-top: 1px solid #e0e0e0;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transform: translateY(100%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  z-index: 520;
}

.reading-footer.visible {
  transform: translateY(0);
  opacity: 1;
}

.reading-progress {
  font-size: 0.875rem;
  color: #666;
  display: flex;
  gap: 1.5rem;
}

.reading-floor {
  color: #999;
}

.reading-controls {
  display: flex;
  gap: 0.5rem;
}

.reading-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.reading-btn:hover:not(:disabled) {
  border-color: #000;
  background: #f5f5f5;
}

.reading-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reading-btn.reading-exit {
  background: #f5f5f5;
  border-color: #ccc;
}

.reading-btn.reading-exit:hover {
  background: #e0e0e0;
}

/* 响应式 */
@media (max-width: 768px) {
  .chat-header {
    padding: 2rem 1.5rem 1.5rem;
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.375rem;
    max-width: none;
  }

  .action-button,
  .reset-button {
    width: auto;
    flex: 0 0 auto;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
  }

  .chat-title {
    font-size: 1.5rem;
  }

  .message-block {
    padding: 2rem 1.5rem;
  }

  .message-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .upload-area {
    padding: 1rem;
  }

  .upload-label {
    padding: 3rem 1.5rem;
  }

  /* 搜索栏移动端 */
  .search-bar {
    flex-direction: column;
    padding: 0.75rem 1.5rem;
    gap: 0.5rem;
  }

  .search-input-wrapper {
    max-width: none;
  }

  /* 分页移动端 */
  .pagination-bar {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  /* 正则管理器移动端 */
  .regex-manager {
    padding: 1rem 1.5rem;
  }

  .regex-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .regex-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .regex-actions .btn {
    flex: 1;
    min-width: 80px;
  }

  .script-item {
    flex-wrap: wrap;
  }

  .script-controls {
    width: 100%;
    justify-content: flex-end;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #eee;
  }
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.color-input {
  width: 50px;
  height: 30px;
  padding: 0;
  border: 1px solid #ddd;
  cursor: pointer;
  background: none;
}

.color-value {
  font-family: monospace;
  font-size: 0.875rem;
  color: #666;
}
</style>

<style>
/* 在线字体加载 - 非scoped以便全局生效 */
@font-face {
  font-family: 'Alegreya';
  src: url('~@/assets/fonts/Alegreya.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '仓耳云黑';
  src: url('~@/assets/fonts/cangeryunhei.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '汇文明朝';
  src: url('~@/assets/fonts/huiwenmingchao.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '空明朝';
  src: url('~@/assets/fonts/kongmingchao.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '屏显臻宋';
  src: url('~@/assets/fonts/pingxianzhensong.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '文悦民国仿宋';
  src: url('~@/assets/fonts/wenyueminguofangsong.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* =========================================
   预览框专用样式 (Preview Fix)
   ========================================= */

/* 1. 确保斜体颜色生效 */
.style-preview-content em,
.style-preview-content i {
  font-style: italic;
  /* 使用变量，加 !important 确保不被主色覆盖 */
  color: var(--italic-color, inherit) !important;
}

/* 2. 确保下划线颜色生效 */
.style-preview-content u {
  text-decoration: underline;
  /* 下划线颜色 */
  text-decoration-color: var(--underline-color, inherit) !important;
  /* 文字本身颜色 */
  color: var(--underline-color, inherit) !important;
}

/* 3. 确保引用块颜色和引用线生效 */
.style-preview-content blockquote {
  /* 核心修复：强制显示左侧边框 */
  border-left-style: solid !important;
  border-left-width: 4px !important;
  border-left-color: var(--quote-color, #666) !important;

  /* 字体颜色 */
  color: var(--quote-color, #666) !important;

  /* 布局修正 */
  padding-left: 1rem !important;
  margin: 1rem 0 !important;
  opacity: 1 !important;
  /* 防止透明度干扰 */
}

/* =========================================================
   🌙 夜间模式 (Dark Mode) - 放在 CSS 最底部以确保覆盖
   ========================================================= */

/* 1. 全局背景与容器 */
.dark-mode.st-reader {
  /* 【修改】使用新的深色纹理背景 */
  background-image: url('https://sazankaze.neocities.org/bg_pic/black-texture1.png');
  background-repeat: repeat;
  background-attachment: fixed;

  background-color: #121212;
  /* 图片加载失败时的备用底色 */
  color: #e0e0e0;
}

.dark-mode .chat-container {
  background: #1e1e1e;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  border-left: 1px solid #333;
  border-right: 1px solid #333;
}

.dark-mode .chat-header {
  border-bottom-color: #444;
}

.dark-mode .chat-title {
  color: #e0e0e0;
}

/* 2. 按钮与交互元素 */
.dark-mode .action-button,
.dark-mode .reset-button,
.dark-mode .page-btn,
.dark-mode .btn-secondary,
.dark-mode .btn-icon,
.dark-mode .swipe-btn,
.dark-mode .edit-btn {
  background: #2d2d2d;
  border-color: #444;
  color: #ccc;
}

.dark-mode .action-button:hover,
.dark-mode .reset-button:hover,
.dark-mode .btn-secondary:hover {
  background: #444;
  color: #fff;
  border-color: #666;
}

/* 激活状态的按钮 */
.dark-mode .action-button.active,
.dark-mode .page-btn.active {
  background: #4a90d9;
  border-color: #4a90d9;
  color: #fff;
}

/* 3. 面板 (搜索、设置、正则等) */
.dark-mode .search-bar,
.dark-mode .regex-manager,
.dark-mode .style-panel,
.dark-mode .pagination-bar {
  background: #1e1e1e;
  border-color: #444;
  color: #ccc;
}

.dark-mode .style-label,
.dark-mode .pagination-info,
.dark-mode .chat-meta {
  color: #888;
}

/* 输入框 */
.dark-mode input[type="text"],
.dark-mode input[type="number"],
.dark-mode textarea,
.dark-mode .search-input,
.dark-mode .style-select,
.dark-mode .form-input,
.dark-mode .edit-textarea {
  background: #2d2d2d;
  border-color: #444;
  color: #e0e0e0;
}

.dark-mode input:focus,
.dark-mode textarea:focus,
.dark-mode select:focus {
  border-color: #666;
  background: #333;
}

/* 4. 消息气泡 */
.dark-mode .message-block {
  border-bottom-color: #333;
}

/* 用户消息深色背景 */
.dark-mode .user-message {
  background: rgba(255, 255, 255, 0.05) !important;
  border-left-color: #666 !important;
}

.dark-mode .user-message .speaker-name {
  color: #ddd;
}

.dark-mode .speaker-name {
  color: #aaa;
}

/* 5. 颜色选择器与特殊控件 */
.dark-mode .color-picker-row {
  background: #2d2d2d;
  border-color: #444;
}

.dark-mode .style-divider {
  border-top-color: #333;
}

/* 滑块轨道变暗 */
.dark-mode .style-slider {
  background: #444;
}

.dark-mode .style-slider::-webkit-slider-thumb {
  border-color: #888;
  background: #2d2d2d;
}

/* 6. 阅读模式适配 */
.dark-mode .reading-view {
  background: #121212;
}

.dark-mode .reading-footer {
  background: #1e1e1e;
  border-top-color: #333;
}

.dark-mode .reading-separator {
  border-bottom-color: #333;
}

/* --- 7. 上传区域按钮适配 --- */
.dark-mode .upload-label {
  background: rgba(30, 30, 30, 0.85);
  /* 深色半透明背景 */
  border-color: #666;
  /* 边框变灰 */
  color: #e0e0e0;
  /* 文字变亮 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  /* 阴影加深 */
}

.dark-mode .upload-label:hover {
  background: #e0e0e0;
  border-color: #e0e0e0;
  color: #121212;
}

.dark-mode .upload-hint {
  color: #888;
}

.dark-mode .upload-label:hover .upload-hint {
  color: #444;
  opacity: 1;
}

/* HTML 预览区域的头部工具栏 */
.dark-mode .html-preview-header {
  border-bottom-color: #444;
}

.dark-mode .html-tag {
  background: #333;
  color: #aaa;
}

.dark-mode .preview-toggle {
  background: #2d2d2d;
  border-color: #555;
  color: #ccc;
}

.dark-mode .preview-toggle:hover {
  background: #e0e0e0;
  color: #121212;
  border-color: #e0e0e0;
}

.dark-mode .html-iframe {
  border-color: #444;
}

/* --- 9. 修复编辑框聚焦时的白色闪光 --- */
.dark-mode .edit-textarea:focus {
  background-color: #333 !important;
  border-color: #666 !important;
  color: #e0e0e0 !important;
  box-shadow: none;
}

.dark-mode .search-input:focus {
  background-color: #333 !important;
  border-color: #666 !important;
  color: #e0e0e0 !important;
}

/* --- 10. 分页栏下拉框适配 --- */
.dark-mode .page-size-select {
  background-color: #2d2d2d;
  border-color: #444;
  color: #e0e0e0;
}

.dark-mode .page-size-select:focus {
  border-color: #666;
  background-color: #333;
  outline: none;
}

.dark-mode .page-size-select option {
  background-color: #2d2d2d;
  color: #e0e0e0;
}

/* --- 11. 阅读模式底部菜单适配 --- */

/* 1. 底部菜单栏容器 */
.dark-mode .reading-footer {
  background-color: #1e1e1e !important;
  border-top: 1px solid #333 !important;
  color: #e0e0e0 !important;
  box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.6) !important;
}

/* 2. 菜单栏里的按钮 (退出、上一页、下一页) */
.dark-mode .reading-footer button {
  background-color: #2d2d2d !important;
  color: #ccc !important;
  border: 1px solid #444 !important;
  transition: all 0.2s;
}

.dark-mode .reading-footer button:hover {
  background-color: #e0e0e0 !important;
  color: #121212 !important;
  border-color: #e0e0e0 !important;
}

/* 3. 菜单栏里的页码输入框 */
.dark-mode .reading-footer input[type="number"],
.dark-mode .reading-footer input[type="text"] {
  background-color: #121212 !important;
  color: #fff !important;
  border: 1px solid #444 !important;
}

.dark-mode .reading-footer input:focus {
  border-color: #888 !important;
  background-color: #000 !important;
}

/* 4. 中间的页码分隔符 ( / ) */
.dark-mode .reading-footer span {
  color: #888 !important;
}

/* --- 13. 模式切换按钮图标适配 --- */
.icon-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-icon {
  font-size: 1.1em;
  line-height: 1;
}

.dark-mode .mode-icon.sun {
  color: #ffb74d;
}

.mode-icon.moon {
  color: #5c6bc0;
}

/* --- 14. 正则脚本等适配 --- */
/* =========================================================
   🌙 补全遗漏的夜间模式适配 (Regex, Tags, Favorites, Export)
   ========================================================= */

/* --- 1. 正则脚本与标签过滤器列表 --- */

/* 列表项本身 */
.dark-mode .script-item,
.dark-mode .favorite-item {
  background: #252525;
  border-color: #444;
  color: #e0e0e0;
}

.dark-mode .script-item:hover,
.dark-mode .favorite-item:hover {
  border-color: #666;
  background: #2f2f2f;
}

/* 列表项被禁用时的状态 */
.dark-mode .script-item.disabled {
  background: #1a1a1a;
  opacity: 0.6;
}

/* 脚本/标签的名称 */
.dark-mode .script-name,
.dark-mode .favorite-type {
  color: #fff;
}

/* 脚本的正则内容预览 */
.dark-mode .script-regex {
  color: #aaa;
}

/* 编辑表单区域 */
.dark-mode .script-form {
  background: #252525;
  border-color: #444;
  color: #e0e0e0;
}

/* 表单内的提示文字 */
.dark-mode .form-hint {
  color: #888;
}

/* 列表项内部的小按钮 (上移/下移/编辑/删除) */
.dark-mode .btn-icon {
  background: #333;
  border-color: #555;
  color: #ccc;
}

.dark-mode .btn-icon:hover:not(:disabled) {
  background: #444;
  border-color: #777;
  color: #fff;
}

/* 启用/禁用 切换按钮 */
.dark-mode .btn-toggle {
  background: #1a1a1a;
  border-color: #444;
  color: #888;
}

.dark-mode .btn-toggle.active {
  background: #4a90d9;
  /* 保持蓝色的激活状态，或者用 #ccc */
  border-color: #4a90d9;
  color: #fff;
}


/* 收藏内容文本 */
.dark-mode .favorite-text {
  color: #ddd;
}

/* 收藏元数据 (时间/说话人) */
.dark-mode .favorite-meta {
  color: #777;
}

/* 对话框主体 */
.dark-mode .export-dialog,
.dark-mode .modal-dialog {
  background: #1e1e1e;
  border-color: #444;
  color: #e0e0e0;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}

/* 对话框头部 */
.dark-mode .export-dialog-header,
.dark-mode .modal-header {
  border-bottom-color: #333;
}

/* 关闭按钮 */
.dark-mode .modal-close {
  color: #aaa;
}

.dark-mode .modal-close:hover {
  color: #fff;
}

/* 导出范围输入区域 */
.dark-mode .export-range {
  border-bottom-color: #333;
}

.dark-mode .range-input-group label,
.dark-mode .range-separator,
.dark-mode .range-hint {
  color: #aaa;
}

/* 输入框 */
.dark-mode .range-input {
  background: #2d2d2d;
  border-color: #444;
  color: #fff;
}

/* 导出预览区域 */
.dark-mode .export-preview {
  background: #121212;
  border-color: #333;
}

.dark-mode .export-preview-label {
  color: #888;
}

.dark-mode .export-preview-content {
  color: #ccc;
}

/* 对话框底部 */
.dark-mode .export-dialog-footer,
.dark-mode .modal-footer {
  background: #252525;
  border-top-color: #333;
}

/* 导出选项 (Checkbox 文字) */
.dark-mode .export-option {
  color: #ccc;
}

/* 字体导入界面的分割线 */
.dark-mode .import-divider {
  color: #666;
}

.dark-mode .import-divider::before,
.dark-mode .import-divider::after {
  background: #444;
}

.dark-mode .import-method-header {
  color: #ccc;
}

.dark-mode .file-selected {
  color: #aaa;
}

.dark-mode .custom-font-item {
  background: #2d2d2d;
  border-color: #444;
}

.dark-mode .custom-font-name {
  color: #e0e0e0;
}

/* --- 补充：样式面板预览框的夜间模式 --- */
.dark-mode .style-preview-content {
  background-color: #252525 !important;
  border-color: #444 !important;
  color: #e0e0e0;
}

/* 1. 多行代码块容器 (PRE) */
.dark-mode .message-content pre,
.dark-mode .message-content-mixed pre,
.dark-mode .reading-content pre {
  background-color: #1e1e1e !important;
  border: 1px solid #333 !important;
  color: #d4d4d4 !important;
  padding: 1em !important;
  overflow-x: auto !important;
  margin: 1em 0 !important;
}

/* 2. PRE 里面的 CODE */
.dark-mode .message-content pre code,
.dark-mode .message-content-mixed pre code,
.dark-mode .reading-content pre code {
  background-color: transparent !important;
  border: none !important;
  color: inherit !important;
  padding: 0 !important;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace !important;
}

/* 3. 行内代码 */
.dark-mode .message-content code:not(pre code),
.dark-mode .message-content-mixed code:not(pre code),
.dark-mode .reading-content code:not(pre code) {
  background-color: #3e3e3e !important;
  color: #e0e0e0 !important;
  border: 1px solid #555 !important;
  padding: 2px 6px !important;
  font-family: Consolas, Monaco, monospace !important;
  font-size: 0.9em !important;
}

/* 亲密度按钮样式 */
.intimacy-btn {
  color: #e91e63;
  border-color: #e91e63;
  background: #fff0f5;
  /* 浅粉色背景 */
}

.intimacy-btn:hover {
  background: #e91e63;
  color: #fff;
}

.intimacy-btn.active {
  background: #e91e63;
  color: #fff;
}

/* 弹窗样式 */
.intimacy-dialog {
  max-width: 700px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #f8f9fa;
  padding: 1.25rem;
  border-radius: 0px;
  text-align: center;
  border: 1px solid #eee;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 30, 99, 0.15);
  border-color: #e91e63;
}

.stat-label {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #333;
  line-height: 1.2;
}

.stat-value.text-sm {
  font-size: 1.1rem;
  /* 日期文字稍微小一点 */
}

.stat-value .unit {
  font-size: 0.9rem;
  font-weight: normal;
}

.stat-sub {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.25rem;
}

/* 热力图样式 */
.heatmap-section {
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.heatmap-header h4 {
  margin: 0;
  font-weight: 700;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: #666;
}

.legend-item {
  width: 10px;
  height: 10px;
  border-radius: 0px;
  display: inline-block;
}

.heatmap-scroll {
  overflow-x: auto;
  padding-bottom: 10px;
}

.heatmap-grid {
  display: flex;
  gap: 3px;
  /* 使得容器高度刚好包裹7行方块 */
  height: calc(12px * 8);
}

.heatmap-week-col {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-right: 4px;
  font-size: 0.7rem;
  color: #999;
  height: calc(100% - 2px);
}

.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-day {
  width: 12px;
  height: 12px;
  border-radius: 0px;
  background-color: #ebedf0;
  /* 默认灰色 Level 0 */
  transition: all 0.2s;
}

.heatmap-day:hover {
  transform: scale(1.2);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* 颜色等级 (粉色系) */
.heatmap-day.level-1,
.legend-item.level-1 {
  background-color: #fce4ec;
}

.heatmap-day.level-2,
.legend-item.level-2 {
  background-color: #f48fb1;
}

.heatmap-day.level-3,
.legend-item.level-3 {
  background-color: #e91e63;
}

.heatmap-day.level-4,
.legend-item.level-4 {
  background-color: #880e4f;
}

/* ============================
   🌙 夜间模式适配
   ============================ */

/* 按钮 */
.dark-mode .intimacy-btn {
  background: rgba(233, 30, 99, 0.15);
  border-color: #e91e63;
  color: #f48fb1;
}

.dark-mode .intimacy-btn:hover {
  background: #e91e63;
  color: #fff;
}

/* 弹窗卡片 */
.dark-mode .stat-card {
  background: #252525;
  border-color: #444;
}

.dark-mode .stat-label {
  color: #aaa;
}

.dark-mode .stat-value {
  color: #e0e0e0;
}

.dark-mode .stat-sub {
  color: #666;
}

.dark-mode .stat-card:hover {
  border-color: #f48fb1;
}

/* === 日历样式 === */
.calendar-section {
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
  margin-top: 1rem;
}

.calendar-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.calendar-header-row h4 {
  margin: 0;
  font-weight: 700;
}

/* 容器：允许垂直滚动 */
.calendar-scroll-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 5px;
  /* 防止滚动条遮挡 */
}

/* 月份卡片布局：宽屏下并排显示，窄屏单列 */
.calendar-months-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.month-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 0px;
  padding: 1rem;
}

.month-title {
  text-align: center;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #333;
}

/* 7列网格 */
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday-header {
  text-align: center;
  font-size: 0.75rem;
  color: #999;
  padding-bottom: 4px;
}

.day-cell {
  aspect-ratio: 1;
  /* 保持正方形 */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0px;
  background: #f5f5f5;
  /* 默认无数据颜色 */
  font-size: 0.75rem;
  color: #999;
  cursor: default;
  transition: all 0.2s;
  position: relative;
}

.day-cell.padding {
  background: transparent;
  /* 空白占位 */
}

/* 有数据的格子 */
.day-cell.has-data {
  color: #333;
  cursor: pointer;
}

/* 悬停效果 */
.day-cell.has-data:hover {
  transform: scale(1.15);
  z-index: 2;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* 颜色等级 (日间模式) */
.day-cell.level-1 {
  background-color: #fce4ec;
  color: #880e4f;
}

.day-cell.level-2 {
  background-color: #f48fb1;
  color: #fff;
  font-weight: bold;
}

.day-cell.level-3 {
  background-color: #e91e63;
  color: #fff;
  font-weight: bold;
}

.day-cell.level-4 {
  background-color: #880e4f;
  color: #fff;
  font-weight: bold;
}

/* 日历控件容器 */
.calendar-widget {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 0px;
  overflow: hidden;
  max-width: 400px;
  /* 限制日历宽度，让它看起来更精致 */
  margin: 0 auto;
  /* 居中显示 */
}

/* 顶部导航 */
.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.current-month-label {
  font-weight: 700;
  font-size: 1rem;
  color: #333;
}

.nav-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 0px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #000;
  color: #fff;
  border-color: #000;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: #f5f5f5;
}

/* 月份卡片 (单视图模式) */
.month-card.single-view {
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 1rem;
}

/* 底部统计栏 */
.month-footer-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #fdfdfd;
  border-top: 1px solid #eee;
  gap: 1.5rem;
}

.footer-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.f-label {
  font-size: 0.75rem;
  color: #888;
}

.f-value {
  font-size: 1rem;
  font-weight: 700;
  color: #e91e63;
  /* 呼应爱心主题色 */
}

.footer-divider {
  width: 1px;
  height: 12px;
  background: #ddd;
}

/* 夜间模式适配 */
.dark-mode .calendar-widget {
  background: #252525;
  border-color: #444;
}

.dark-mode .calendar-nav {
  background: #2d2d2d;
  border-bottom-color: #444;
}

.dark-mode .current-month-label {
  color: #e0e0e0;
}

.dark-mode .nav-btn {
  background: #333;
  border-color: #555;
  color: #ccc;
}

.dark-mode .nav-btn:hover:not(:disabled) {
  background: #e0e0e0;
  color: #121212;
}

.dark-mode .month-card.single-view {
  background: transparent;
}

.dark-mode .month-footer-stats {
  background: #2d2d2d;
  border-top-color: #444;
}

.dark-mode .f-label {
  color: #888;
}

.dark-mode .f-value {
  color: #f48fb1;
}

/* === 🌙 日历夜间模式适配 === */
.dark-mode .calendar-section {
  border-top-color: #333;
}

.dark-mode .calendar-header-row h4 {
  color: #e0e0e0;
}

.dark-mode .month-card {
  background: #252525;
  border-color: #444;
}

.dark-mode .month-title {
  color: #e0e0e0;
}

.dark-mode .weekday-header {
  color: #888;
}

.dark-mode .day-cell {
  background: #2f2f2f;
  color: #666;
}

/* 夜间模式颜色等级 */
.dark-mode .day-cell.level-1 {
  background-color: #5c2b3b;
  color: #ffcdd2;
}

.dark-mode .day-cell.level-2 {
  background-color: #a04264;
  color: #fff;
}

.dark-mode .day-cell.level-3 {
  background-color: #e91e63;
  color: #fff;
}

.dark-mode .day-cell.level-4 {
  background-color: #ff80ab;
  color: #000;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* === 自定义悬浮提示框样式 === */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  /* 深色半透明背景 */
  color: #fff;
  padding: 8px 12px;
  border-radius: 0px;
  font-size: 0.8rem;
  pointer-events: none;
  /* 关键：让鼠标事件穿透，防止闪烁 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 120px;
  backdrop-filter: blur(4px);
}

.tooltip-header {
  font-weight: 700;
  margin-bottom: 6px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  white-space: nowrap;
}

.tooltip-row:last-child {
  margin-bottom: 0;
}

.tooltip-icon {
  font-size: 1rem;
  color: #f48fb1;
  /* 粉色图标 */
}

/* 夜间模式适配 (其实因为它是黑底白字，夜间模式不需要大改，稍微调整边框即可) */
.dark-mode .custom-tooltip {
  background: rgba(30, 30, 30, 0.95);
  border-color: #444;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.dark-mode .tooltip-header {
  color: #e0e0e0;
}

/* === Markdown 元素阅读模式增强 === */

/* 1. 强制禁止断开的元素 */
/* 确保列表、代码块、引用、标题完整显示，不被切成两半 */
.reading-content :deep(ul),
.reading-content :deep(ol),
.reading-content :deep(li),
.reading-content :deep(pre),
.reading-content :deep(blockquote),
.reading-content :deep(h1), 
.reading-content :deep(h2), 
.reading-content :deep(h3), 
.reading-content :deep(h4), 
.reading-content :deep(h5), 
.reading-content :deep(h6) {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* 2. 限制图片大小 */
/* 防止大图撑破列高导致错位 */
.reading-content :deep(img) {
  max-width: 100%;
  max-height: 95vh; /* 限制最大高度，留一点余地 */
  object-fit: contain;
  break-inside: avoid;
}

/* 3. 修复代码块 (PRE) */
/* 代码块默认不换行，会导致横向撑宽页面，导致页码计算错误 */
.reading-content :deep(pre) {
  white-space: pre-wrap;       /* 强制换行 */
  word-wrap: break-word;       /* 长单词换行 */
  word-break: break-all;       /* 暴力换行防溢出 */
  max-width: 100%;             /* 限制宽度 */
  box-sizing: border-box;
}

/* 4. 修复列表缩进 */
/* 列表有时候左边距会产生奇怪的偏移 */
.reading-content :deep(ul),
.reading-content :deep(ol) {
  padding-left: 1.5rem;
  box-sizing: border-box;
}

/* 5. 修复水平分割线 */
.reading-content :deep(hr) {
  break-inside: avoid;
  margin: 1rem 0;
  border: 0;
  border-top: 1px solid #ccc;
}
</style>