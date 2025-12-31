<template>
  <div class="st-reader">
    <div v-if="!messages.length" class="upload-area">
      <div class="upload-container">
        <input
          type="file"
          ref="fileInput"
          @change="handleFileUpload"
          accept=".jsonl"
          id="file-input"
          class="file-input"
        />
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
            标签过滤 <span v-if="tagFilters.length">({{ tagFilters.filter(f => !f.disabled).length }})</span>
          </button>
          <button @click="toggleRegexManager" class="action-button regex-button">
            正则脚本 <span v-if="regexScripts.length">({{ regexScripts.filter(s => !s.disabled).length }})</span>
          </button>
          <button @click="toggleFavoritesPanel" :class="['action-button', { 'active': showFavoritesPanel }]">
            收藏夹 <span v-if="favorites.length">({{ favorites.length }})</span>
          </button>
          <button @click="openExportRangeDialog" class="action-button">
            导出
          </button>
          <button @click="toggleStylePanel" :class="['action-button', { 'active': showStylePanel }]">
            样式
          </button>
          <button @click="toggleReadingMode" :class="['action-button', 'reading-mode-btn', { 'active': readingMode }]">
            {{ readingMode ? '退出阅读' : '阅读模式' }}
          </button>
          <button @click="resetReader" class="reset-button">重新加载</button>
        </div>
      </div>

      <div v-if="showSearchBar" class="search-bar">
        <div class="search-input-wrapper">
          <input 
            v-model="searchQuery"
            @input="onSearchInput"
            type="text" 
            class="search-input"
            placeholder="搜索消息内容或发言者..."
          />
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
          <div
            v-for="(filter, index) in tagFilters"
            :key="filter.id"
            :class="['script-item', { 'disabled': filter.disabled }]"
          >
            <div class="script-info">
              <div class="script-name">{{ filter.name }}</div>
              <div class="script-regex">
                {{ filter.mode === 'remove' ? '删除' : filter.mode === 'keep' ? '只保留' : '解包' }}: 
                &lt;{{ filter.tagName }}&gt;
              </div>
            </div>
            <div class="script-controls">
              <button @click="moveTagFilterUp(index)" :disabled="index === 0" class="btn-icon" title="上移">↑</button>
              <button @click="moveTagFilterDown(index)" :disabled="index === tagFilters.length - 1" class="btn-icon" title="下移">↓</button>
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
          <div
            v-for="(script, index) in regexScripts"
            :key="script.id"
            :class="['script-item', { 'disabled': script.disabled, 'dragging': dragIndex === index }]"
            draggable="true"
            @dragstart="handleDragStart(index)"
            @dragover="handleDragOver"
            @drop="(e) => handleDrop(e, index)"
            @dragend="handleDragEnd"
          >
            <div class="script-drag-handle">⋮⋮</div>
            <div class="script-info">
              <div class="script-name">{{ script.scriptName }}</div>
              <div class="script-regex">{{ script.findRegex.substring(0, 60) }}{{ script.findRegex.length > 60 ? '...' : '' }}</div>
            </div>
            <div class="script-controls">
              <button @click="moveScriptUp(index)" :disabled="index === 0" class="btn-icon" title="上移">↑</button>
              <button @click="moveScriptDown(index)" :disabled="index === regexScripts.length - 1" class="btn-icon" title="下移">↓</button>
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
          <div v-for="fav in favorites" :key="fav.id" class="favorite-item" @click="navigateToFavorite(fav)" title="点击跳转到对应楼层">
            <div class="favorite-content">
              <div class="favorite-type">{{ fav.type === 'message' ? '📋 楼层' : '📝 句子' }} #{{ fav.messageIndex + 1 }}</div>
              <div class="favorite-text">{{ fav.text.substring(0, 100) }}{{ fav.text.length > 100 ? '...' : '' }}</div>
              <div class="favorite-meta">
                <span v-if="fav.speaker">{{ fav.speaker }}</span>
                <span>{{ formatFavoriteTime(fav.createdAt) }}</span>
              </div>
            </div>
            <div class="favorite-actions">
              <button @click.stop="copyFavorite(fav)" class="btn-icon" title="复制">📋</button>
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
          <div class="style-group">
            <label class="style-label">字体</label>
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
            <button @click="showCustomFontDialog = true" class="btn btn-secondary btn-sm add-font-btn">
              + 导入字体
            </button>
          </div>

          <div class="style-group">
            <label class="style-label">字号</label>
            <div class="style-slider-row">
              <input 
                type="range" 
                v-model.number="textStyles.fontSize" 
                @input="handleStyleChange"
                min="12" 
                max="32" 
                step="1"
                class="style-slider"
              />
              <span class="style-value">{{ textStyles.fontSize }}px</span>
            </div>
          </div>

          <div class="style-group">
            <label class="style-label">行间距</label>
            <div class="style-slider-row">
              <input 
                type="range" 
                v-model.number="textStyles.lineHeight" 
                @input="handleStyleChange"
                min="1.2" 
                max="3" 
                step="0.1"
                class="style-slider"
              />
              <span class="style-value">{{ textStyles.lineHeight.toFixed(1) }}</span>
            </div>
          </div>

          <div class="style-group">
            <label class="style-label">段落间距</label>
            <div class="style-slider-row">
              <input 
                type="range" 
                v-model.number="textStyles.paragraphSpacing" 
                @input="handleStyleChange"
                min="0" 
                max="2" 
                step="0.1"
                class="style-slider"
              />
              <span class="style-value">{{ textStyles.paragraphSpacing.toFixed(1) }}em</span>
            </div>
          </div>

          <div class="style-group">
            <label class="style-label">文字颜色</label>
            <div class="color-options">
              <button 
                v-for="color in colorOptions" 
                :key="color.value"
                @click="setTextColor(color.value)"
                :class="['color-btn', { 'active': textStyles.textColor === color.value }]"
                :style="{ backgroundColor: color.value }"
                :title="color.name"
              ></button>
            </div>
          </div>

          <div class="style-group">
            <label class="style-label">对齐方式</label>
            <div class="align-options">
              <button 
                @click="setTextAlign('left')" 
                :class="['align-btn', { 'active': textStyles.textAlign === 'left' }]"
                title="左对齐"
              >◧</button>
              <button 
                @click="setTextAlign('justify')" 
                :class="['align-btn', { 'active': textStyles.textAlign === 'justify' }]"
                title="两端对齐"
              >▣</button>
              <button 
                @click="setTextAlign('center')" 
                :class="['align-btn', { 'active': textStyles.textAlign === 'center' }]"
                title="居中"
              >◫</button>
            </div>
          </div>
        </div>

        <div class="style-preview">
          <div class="style-preview-label">预览效果：</div>
          <div class="style-preview-content" :style="getPreviewStyles()">
            这是一段示例文字，用于预览当前的样式设置效果。段落之间会有适当的间距。
            <br><br>
            第二段文字。通过调整上方的设置，可以改变正文的显示效果，包括字体、字号、行间距等。
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
                <input 
                  v-model="customFontForm.url" 
                  type="text" 
                  placeholder="输入字体文件的URL（支持 ttf/otf/woff/woff2）" 
                  class="form-input"
                  :disabled="!!customFontForm.file"
                />
              </div>
              
              <div class="import-divider">或</div>
              
              <div class="import-method">
                <div class="import-method-header">方式二：从文件导入</div>
                <input 
                  ref="fontFileInput"
                  type="file" 
                  accept=".ttf,.otf,.woff,.woff2"
                  @change="handleFontFileSelect"
                  class="form-file-input"
                  :disabled="!!customFontForm.url"
                />
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

      <div 
        v-if="highlightMenu.show" 
        class="highlight-menu"
        :style="{ left: highlightMenu.x + 'px', top: highlightMenu.y + 'px' }"
      >
        <button @click="removeHighlightFromMenu" class="selection-btn">✕ 取消划线</button>
      </div>

      <div v-if="!readingMode" class="messages-wrapper">
        <div
          v-for="(message, index) in paginatedMessages"
          :key="currentRange.start + index"
          :class="['message-block', { 'user-message': message.is_user }]"
        >
          <div class="message-header">
            <span class="speaker-name">{{ message.name }}</span>
            <div class="message-info">
              <span v-if="message.send_date" class="timestamp">{{ message.send_date }}</span>
              <span v-if="message.model" class="model-tag">{{ message.model }}</span>
              <button 
                @click="toggleFavoriteMessage(getGlobalMessageIndex(index), message)"
                :class="['edit-btn', { 'favorited': isMessageFavorited(getGlobalMessageIndex(index)) }]"
                :title="isMessageFavorited(getGlobalMessageIndex(index)) ? '取消收藏' : '收藏楼层'"
              >
                {{ isMessageFavorited(getGlobalMessageIndex(index)) ? '★' : '☆' }}
              </button>
              <button 
                @click="toggleEditMessage(getGlobalMessageIndex(index))" 
                class="edit-btn"
                :title="editingMessageIndex === getGlobalMessageIndex(index) ? '取消编辑' : '编辑消息'"
              >
                {{ editingMessageIndex === getGlobalMessageIndex(index) ? '✕' : '✎' }}
              </button>
            </div>
          </div>

          <div v-if="editingMessageIndex === getGlobalMessageIndex(index)" class="message-edit-form">
            <textarea 
              v-model="editingContent"
              class="edit-textarea"
              rows="10"
            ></textarea>
            <div class="edit-actions">
              <button @click="cancelEditMessage" class="btn btn-secondary">取消</button>
              <button @click="saveEditMessage" class="btn btn-primary">保存</button>
            </div>
          </div>

          <template v-if="editingMessageIndex !== getGlobalMessageIndex(index)">
          <div 
            v-if="hasHTMLCodeBlock(getMessageContent(message))" 
            class="message-content-mixed"
            :style="getContentStyles()"
            @mouseup="handleTextSelection($event, getGlobalMessageIndex(index), message)"
          >
            <div class="message-content" :style="getContentStyles()" v-html="renderContentWithHTMLPlaceholder(getMessageContent(message), getGlobalMessageIndex(index))"></div>
          </div>
          <div v-else-if="isFullHTML(getMessageContent(message))" class="message-content-html">
            <div class="html-preview-header">
              <span class="html-tag">HTML 文档</span>
              <button @click="toggleHTMLPreview(getGlobalMessageIndex(index))" class="preview-toggle">
                {{ message.showPreview ? '隐藏预览' : '显示预览' }}
              </button>
            </div>
            <iframe 
              v-if="message.showPreview"
              :srcdoc="getMessageContent(message)" 
              class="html-iframe"
              sandbox="allow-scripts allow-same-origin"
            ></iframe>
            <pre v-else class="html-code">{{ getMessageContent(message) }}</pre>
          </div>
          <div 
            v-else 
            class="message-content" 
            :style="getContentStyles()"
            v-html="renderContent(getMessageContent(message), getGlobalMessageIndex(index))"
            @mouseup="handleTextSelection($event, getGlobalMessageIndex(index), message)"
          ></div>
          </template>

          <div v-if="message.swipes && message.swipes.length > 1" class="swipe-controls">
            <button 
              @click="prevSwipe(getGlobalMessageIndex(index))" 
              :disabled="message.currentSwipeIndex === 0"
              class="swipe-btn"
              title="上一条"
            >
              ◀
            </button>
            <span class="swipe-indicator">
              {{ message.currentSwipeIndex + 1 }} / {{ message.swipes.length }}
            </span>
            <button 
              @click="nextSwipe(getGlobalMessageIndex(index))" 
              :disabled="message.currentSwipeIndex === message.swipes.length - 1"
              class="swipe-btn"
              title="下一条"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div v-if="readingMode" class="reading-view" ref="readingView">
        <div 
          class="reading-content" 
          ref="readingContentEl"
          :style="getReadingTransform()"
          v-html="readingFullHtml"
          @mouseup="onReadingMouseUp"
          @touchstart="onReadingTouchStart"
          @touchend="onReadingTouchEnd"
        ></div>
        
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
            <button @click="readingNextPage" :disabled="readingCurrentPage >= readingTotalPages" class="reading-btn">▶</button>
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
          <button @click="goToPage(totalPages)" :disabled="currentPage === totalPages" class="page-btn" title="末页">⟩⟩</button>
          <select v-model.number="pageSize" @change="onPageSizeChange" class="page-size-select">
            <option :value="10">10条/页</option>
            <option :value="20">20条/页</option>
            <option :value="50">50条/页</option>
            <option :value="100">100条/页</option>
          </select>
        </div>
      </div>
    </div>

    <div 
      v-if="selectionMenu.show" 
      class="selection-menu"
      :style="{ left: selectionMenu.x + 'px', top: selectionMenu.y + 'px' }"
    >
      <button @click="favoriteSelectedText" class="selection-btn">☆ 收藏</button>
      <button @click="highlightSelectedText" class="selection-btn">🖍 划线</button>
      <button @click="copySelectedText" class="selection-btn">📋 复制</button>
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
                <input 
                  type="number" 
                  v-model.number="exportDialog.startFloor" 
                  :min="1" 
                  :max="filteredMessages.length"
                  class="range-input"
                />
              </div>
              <span class="range-separator">至</span>
              <div class="range-input-group">
                <label>结束楼层</label>
                <input 
                  type="number" 
                  v-model.number="exportDialog.endFloor" 
                  :min="1" 
                  :max="filteredMessages.length"
                  class="range-input"
                />
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
  </div>
</template>

<script>
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default {
  name: 'STReader',
  data() {
    return {
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
        textColor: '#1a1a1a',
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
      resizeTimer: null
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
    this.loadCustomFonts();
    
    // 替换HTML占位符
    this.replaceHTMLPlaceholders();
    
    // 点击其他地方关闭选择菜单
    document.addEventListener('mousedown', this.hideSelectionMenu);
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
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
      this.textStyles = {
        fontFamily: 'system',
        fontSize: 16,
        lineHeight: 1.8,
        paragraphSpacing: 1,
        textColor: '#1a1a1a',
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
        fontFamily: this.getFontFamily(),
        fontSize: this.textStyles.fontSize + 'px',
        lineHeight: this.textStyles.lineHeight,
        color: this.textStyles.textColor,
        textAlign: this.textStyles.textAlign
      };
    },

    getContentStyles() {
      return {
        fontFamily: this.getFontFamily(),
        fontSize: this.textStyles.fontSize + 'px',
        lineHeight: this.textStyles.lineHeight,
        color: this.textStyles.textColor,
        textAlign: this.textStyles.textAlign,
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
        this.showSearchBar = false;
        this.showRegexManager = false;
        this.showTagFilterManager = false;
        this.showFavoritesPanel = false;
        this.showStylePanel = false;
        this.selectionMenu.show = false;
        
        // 重置页码
        this.readingCurrentPage = 1;
        
        // 禁止页面滚动
        document.body.style.overflow = 'hidden';

        // 生成阅读内容
        this.generateReadingContent();
        
        // 监听窗口调整
        window.addEventListener('resize', this.handleResize);
        
      } else {
        // 退出阅读模式
        document.body.style.overflow = '';
        this.toolbarVisible = false;
        window.removeEventListener('resize', this.handleResize);
      }
    },

    generateReadingContent() {
      let fullContent = '';
      
      for (let i = 0; i < this.filteredMessages.length; i++) {
        const message = this.filteredMessages[i];
        let content = this.getMessageContent(message);
        
        // 使用 renderContent 来正确处理 HTML 块和 Markdown
        // renderContent 会保护正则脚本生成的 HTML 块不被 Markdown 解析器干扰
        content = this.renderContent(content, i);
        
        // 分隔符 (非第一条)
        if (i > 0) {
          fullContent += '<div class="reading-separator"></div>';
        }
        
        // 用 div 包裹每条消息，添加 data-floor 属性用于划线功能
        fullContent += `<div class="reading-message" data-floor="${i}">`;
        
        // 名字
        if (message.name) {
          fullContent += `<p class="reading-speaker-name">【${message.name}】</p>`;
        }
        
        fullContent += content;
        fullContent += '</div>';
      }
      
      // 保存当前页码（刷新时保持位置）
      const currentPage = this.readingCurrentPage || 1;
      
      this.readingFullHtml = fullContent;
      
      // 动态设置列宽为窗口宽度
      this.$nextTick(() => {
        // 重置宽度让 CSS columns 重新计算
        const contentEl = this.$refs.readingContentEl;
        if (contentEl) {
          contentEl.style.width = '';
        }
        
        this.updateColumnWidth();
        // 等待 CSS columns 布局完成后计算总页数
        this.$nextTick(() => {
          setTimeout(() => {
            this.calculateTotalPages();
            // 恢复页码（但不超过新的总页数）
            this.readingCurrentPage = Math.min(currentPage, this.readingTotalPages);
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

    calculateTotalPages() {
      const contentEl = this.$refs.readingContentEl;
      if (!contentEl) return;

      // 使用 window.innerWidth 作为每页宽度
      const pageWidth = window.innerWidth;
      
      // 获取内容实际宽度（scrollWidth 包含所有列的宽度）
      const contentWidth = contentEl.scrollWidth;
      
      // 关键修复：手动设置元素宽度为 scrollWidth，这样 translateX 才能正确显示后续列
      if (contentWidth > contentEl.offsetWidth) {
        contentEl.style.width = `${contentWidth}px`;
      }
      
      // 记录窗口宽度用于偏移计算
      this.windowWidth = pageWidth;
      
      // 总页数
      this.readingTotalPages = Math.max(1, Math.ceil(contentWidth / pageWidth));
      
      // 修正当前页码
      if (this.readingCurrentPage > this.readingTotalPages) {
        this.readingCurrentPage = this.readingTotalPages;
      }
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
      // 简单估算进度，更精确的楼层需要 IntersectionObserver，这里简化处理
      return `${this.readingCurrentPage} / ${this.readingTotalPages}`;
    },

    readingPrevPage() {
      if (this.readingCurrentPage > 1) {
        this.readingCurrentPage--;
      }
    },

    readingNextPage() {
      if (this.readingCurrentPage < this.readingTotalPages) {
        this.readingCurrentPage++;
      }
    },

    // 交互逻辑
    handleReadingClick(e) {
      const width = window.innerWidth;
      const clickX = e.clientX;
      
      // 左 30% 上一页
      if (clickX < width * 0.3) {
        this.readingPrevPage();
      } 
      // 右 30% 下一页
      else if (clickX > width * 0.7) {
        this.readingNextPage();
      } 
      // 中间 40% 菜单
      else {
        this.toolbarVisible = !this.toolbarVisible;
        
        if (this.toolbarVisible) {
          if (this.toolbarTimeout) clearTimeout(this.toolbarTimeout);
          this.toolbarTimeout = setTimeout(() => {
            this.toolbarVisible = false;
          }, 3000);
        }
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
    }
  }
};
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
  /* --- 新增/修改以下属性 --- */
  flex-wrap: wrap;           /* 允许按钮换行 */
  justify-content: flex-end; /* 让按钮保持靠右对齐 */
  max-width: 380px;          /* 关键点：限制宽度。 */
                             /* 宽度越小，换到第二行的按钮就越多。你可以尝试调整这个数值 (比如 350px 或 400px) */
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
  padding-bottom: 80px; /* 为固定的分页控件留出空间 */
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
  border-radius: 2px;
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
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
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
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

/* 楼层高亮闪烁效果 */
@keyframes highlight-flash {
  0%, 100% { background-color: inherit; }
  25%, 75% { background-color: rgba(255, 235, 59, 0.3); }
  50% { background-color: rgba(255, 235, 59, 0.5); }
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
  gap: 1.25rem;
  padding: 1rem 0;
}

.style-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.style-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

.style-select {
  width: 100%;
  max-width: 300px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.style-select:hover {
  border-color: #999;
}

.style-select:focus {
  outline: none;
  border-color: #000;
}

.style-slider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.style-slider {
  flex: 1;
  max-width: 250px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.style-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #000;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
}

.style-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.style-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #000;
  border: none;
  border-radius: 50%;
  cursor: pointer;
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
  overflow: hidden; /* 隐藏浏览器原生滚动条 */
}

/* 内容长条：利用 CSS Columns 分页 */
.reading-content {
  height: calc(100vh - 3rem); /* 固定高度，留出底部控制栏空间 */
  /* width 由 JS 动态设置为 scrollWidth */
  min-width: 100vw;           /* 初始最小宽度为视窗宽度 */
  box-sizing: border-box;
  
  /* CSS Columns 核心设置 - column-width 由 JS 动态设置 */
  column-gap: 0;              /* 列间距为0，padding在列内部 */
  column-fill: auto;          /* 内容先填满一列（高度），再填下一列 */
  
  /* 无外部padding，padding在列内部通过内容样式处理 */
  padding: 2rem 0 3rem 0;
  
  text-align: justify;
  overflow: visible;          /* 允许溢出，scrollWidth 才能正确计算 */
  
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
  color:#666;
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
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.375rem;
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
</style>

<style>
/* 在线字体加载 - 非scoped以便全局生效 */
@font-face {
  font-family: 'Alegreya';
  src: url('https://sazankaze.neocities.org/fonts/Alegreya.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '仓耳云黑';
  src: url('https://sazankaze.neocities.org/fonts/cangeryunhei.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '汇文明朝';
  src: url('https://sazankaze.neocities.org/fonts/huiwenmingchao.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '空明朝';
  src: url('https://sazankaze.neocities.org/fonts/kongmingchao.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '屏显臻宋';
  src: url('https://sazankaze.neocities.org/fonts/pingxianzhensong.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: '文悦民国仿宋';
  src: url('https://sazankaze.neocities.org/fonts/wenyueminguofangsong.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
</style>