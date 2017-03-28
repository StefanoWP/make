/*global jQuery, tinyMCE, switchEditors */
var oneApp = oneApp || {}, ttfMakeFrames = ttfMakeFrames || [];

(function ($, Backbone, oneApp, ttfMakeFrames) {
	'use strict';

	// Builder root view
	var MakeBuilder = Backbone.View.extend({
		activeTextAreaID: '',
		activeiframeID: '',
		tinymceOverlay: false,
		settingsOverlay: false,

		$stage: false,
		$makeTextArea: false,
		$makeEditor: false,
		$currentPlaceholder: false,
		$scrollHandle: false,

		options: {
			openSpeed : 400,
			closeSpeed: 250
		},

		events: {
			'section-created': 'onSectionCreated',
			'section-sort': 'onSectionSort',
			'uploader-image-removed': 'onUploaderFrameRemoveImage'
		},

		templateSettings: {
			evaluate: /<#([\s\S]+?)#>/g,
			interpolate: /\{\{\{([\s\S]+?)\}\}\}/g,
			escape: /\{\{([^\}]+?)\}\}(?!\})/g
		},

		initialize: function(options) {
			Backbone.View.prototype.initialize.apply(this, arguments);
		},

		render: function() {
			this.$stage = $('#ttfmake-stage');
			this.$makeTextArea = $('#make');
			this.$makeEditor = $('#wp-make-wrap');
			this.$scrollHandle = $('html, body');

			this.sections = new oneApp.collections.section();

			if (typeof ttfMakeSectionData === 'object') {
				this.sections.reset(ttfMakeSectionData, {parse: true});
			}

			var sectionView;
			this.sections.forEach(function(section) {
				sectionView = this.addSectionView(section);
			}, this);

			this.initSortables();
			this.initOverlayViews();
			this.initFrames();

			var self = this;
			$('body').on('click', '.ttfmake-remove-image-from-modal', function(e) {
				e.preventDefault();
				self.$stage.trigger('uploader-image-removed')
			});

			$('body').on('click', function(e) {
				self.$stage.find('.ttfmake-configure-item-button').removeClass('active');
				self.$stage.find('.configure-item-dropdown').hide();
			});

			return this;
		},

		onSectionCreated: function(e, sectionType) {
			var modelClass = oneApp.models[sectionType];
			var sectionDefaults = ttfMakeSectionDefaults[sectionType] || {};
			var modelAttributes = _(modelClass.prototype.defaults)
				.extend(sectionDefaults, {
					'section-type': sectionType,
					'id': new Date().getTime()
				});

			var model = new modelClass(modelAttributes);
			this.sections.add(model);

			var sectionView = this.addSectionView(model);
			this.scrollToSectionView(sectionView);
			this.toggleStageClass();
		},

		onSectionSort: function(e, ids) {
			var sortedSections = _(ids).map(function(id) {
				return this.sections.find(function(section) {
					return section.id.toString() == id.toString();
				});
			}, this);

			this.sections.reset(sortedSections);
		},

		addSectionView: function (section, previousSection) {
			var viewClass = oneApp.views[section.get('section-type')];
			var view = new viewClass({
				model: section
			});

			var html = view.render().el;

			if (typeof previousSection !== 'undefined') {
				previousSection.$el.after(html);
			} else {
				this.$stage.append(html);
			}

			view.$el.trigger('view-ready', view);

			return view;
		},

		toggleStageClass: function() {
			if (this.sections.length > 0) {
				this.$stage.removeClass('ttfmake-stage-closed');
			} else {
				this.$stage.addClass('ttfmake-stage-closed');
				$('html, body').animate({
					scrollTop: $('#ttfmake-menu').offset().top
				}, this.options.closeSpeed);
			}
		},

		scrollToSectionView: function (view) {
			// Scroll to the new section
			var self = this;
			this.$scrollHandle.animate({
				scrollTop: view.$el.offset().top - 32 - 9 // Offset + admin bar height + margin
			}, 800, 'easeOutQuad', function() {
				self.focusFirstInput(view);
			});
		},

		initSortables: function () {
			var self = this;

			this.$stage.sortable({
				handle: '.ttfmake-section-header',
				placeholder: 'sortable-placeholder',
				forcePlaceholderSizeType: true,
				distance: 2,
				tolerance: 'pointer',

				start: function (event, ui) {
					// Set the height of the placeholder to that of the sorted item
					var $item = $(ui.item.get(0)),
						$stage = $item.parents('.ttfmake-stage');

					$item.css('-webkit-transform', 'translateZ(0)');
					$('.sortable-placeholder', $stage).height(parseInt($item.height(), 10) - 2);
				},

				stop: function (event, ui) {
					var $item = $(ui.item.get(0)),
						$frames = $('iframe', $item);

					$item.css('-webkit-transform', '');

					var ids = $(this).sortable('toArray', {attribute: 'data-id'});
					$item.trigger('section-sort', [ids]);

					$.each($frames, function() {
						var id = $(this).attr('id').replace('ttfmake-iframe-', '');

						setTimeout(function() {
							self.initFrame(id);
						}, 100);
					});
				}
			});
		},

		filliframe: function (iframeID) {
			var iframe = document.getElementById(iframeID);
			var iframeContent = iframe.contentDocument ? iframe.contentDocument : iframe.contentWindow.document;
			var iframeBody = $('body', iframeContent);
			var content = this.getMakeContent();

			// Since content is being displayed in the iframe, run it through autop
			content = switchEditors.wpautop(this.wrapShortcodes(content));

			iframeBody.html(content);
		},

		getMakeContent: function () {
			var content = '';

			if (this.isVisualActive()) {
				content = tinyMCE.get('make').getContent();
			} else {
				content = this.$makeTextArea.val();
			}

			return content;
		},

		setMakeContent: function (content) {
			if (this.isVisualActive()) {
				tinyMCE.get('make').setContent(switchEditors.wpautop(content));
			} else {
				this.$makeTextArea.val(switchEditors.pre_wpautop(content));
			}
		},

		focusFirstInput: function (view) {
			$('input[type="text"]', view.$el).not('.wp-color-picker').first().focus();
		},

		setTextArea: function (textAreaID) {
			$('#' + textAreaID).val(this.getMakeContent());
		},

		setMakeContentFromTextArea: function (iframeID, textAreaID) {
			var textAreaContent = $('#' + textAreaID).val();

			this.setActiveiframeID(iframeID);
			this.setActiveTextAreaID(textAreaID);
			this.setMakeContent(textAreaContent);
		},

		setActiveiframeID: function(iframeID) {
			this.activeiframeID = iframeID;
		},

		setActiveTextAreaID: function(textAreaID) {
			this.activeTextAreaID = textAreaID;
		},

		getActiveiframeID: function() {
			return this.activeiframeID;
		},

		getActiveTextAreaID: function() {
			return this.activeTextAreaID;
		},

		isTextActive: function() {
			return this.$makeEditor.hasClass('html-active');
		},

		isVisualActive: function() {
			return this.$makeEditor.hasClass('tmce-active');
		},

		initFrames: function() {
			if (ttfMakeFrames.length > 0) {
				var link = this.getFrameHeadLinks();

				// Add content and CSS
				_.each(ttfMakeFrames, function(id) {
					this.initFrame(id, link);
				}, this);
			}
		},

		initFrame: function(id, link) {
			var content = $('#ttfmake-content-' + id).val(),
				iframe = $('#ttfmake-iframe-' + id)[0],
				iframeContent = iframe.contentDocument ? iframe.contentDocument : iframe.contentWindow.document,
				iframeHead = $('head', iframeContent),
				iframeBody = $('body', iframeContent);

			var sectionId = id.split('-')[0];
			var section = this.sections.get(sectionId)
			var backgroundColor = "#ffffff";

			if ('' !== section.get('background-color')) {
				backgroundColor = section.get('background-color');
			}

			link = link || this.getFrameHeadLinks();

			iframeHead.html(link);
			iframeBody.html(switchEditors.wpautop(this.wrapShortcodes(content)));
			iframeBody.css('background-color', backgroundColor);

			// Firefox hack
			// @link http://stackoverflow.com/a/24686535

			var self = this;
			$(iframe).on('load', function() {
				$(this).contents().find('head').html(link);
				$(this).contents().find('body').html(switchEditors.wpautop(self.wrapShortcodes(content)));
			});
		},

		getFrameHeadLinks: function() {
			var scripts = tinyMCEPreInit.mceInit.make.content_css.split(','),
				link = '';

			// Create the CSS links for the head
			_.each(scripts, function(e) {
				link += '<link type="text/css" rel="stylesheet" href="' + e + '" />';
			});

			return link;
		},

		wrapShortcodes: function(content) {
			// Render captions
			content = content.replace(
				/\[caption.*?\](\<img.*?\/\>)[ ]*(.*?)\[\/caption\]/g,
				'<div><dl class="wp-caption alignnone">'
				+ '<dt class="wp-caption-dt">$1</dt>'
				+ '<dd class="wp-caption-dd">$2</dd></dl></div>'
			);

			return content.replace(/^(<p>)?(\[.*\])(<\/p>)?$/gm, '<div class="shortcode-wrapper">$2</div>');
		},

		initOverlayViews: function () {
			this.tinymceOverlay = new oneApp.views['tinymce-overlay']({
				el: $('#ttfmake-tinymce-overlay')
			});

			this.settingsOverlay = new oneApp.views.settings();
		},

		initUploader: function (view, placeholder) {
			this.$currentPlaceholder = $(placeholder);

			// Create the media frame.
			window.frame = wp.media.frames.frame = wp.media({
				title: this.$currentPlaceholder.data('title'),
				className: 'media-frame ttfmake-builder-uploader',
				multiple: false
			});

			frame.on('open', this.onUploaderFrameOpen, this);
			frame.on('select', this.onUploaderFrameSelect, this, 2);

			// Finally, open the modal
			frame.open();
		},

		onUploaderFrameOpen: function() {},

		onUploaderFrameRemoveImage: function() {
			// Remove the image
			this.$currentPlaceholder.css('background-image', '');
			this.$currentPlaceholder.parent().removeClass('ttfmake-has-image-set');

			// Trigger event on the uploader to propagate it to calling view
			this.$currentPlaceholder.trigger('mediaRemoved')

			wp.media.frames.frame.close();
		},

		onUploaderFrameSelect: function() {
			// We set multiple to false so only get one image from the uploader
			var attachment = frame.state().get('selection').first().toJSON();
			// Remove the attachment caption
			attachment.caption = '';
			// Build the image
			var props = wp.media.string.props({}, attachment);
			// Show the image
			this.$currentPlaceholder.css('background-image', 'url(' + attachment.url + ')');
			this.$currentPlaceholder.parent().addClass('ttfmake-has-image-set');
			// Trigger events on the view
			this.$currentPlaceholder.trigger('mediaSelected', attachment);
		},

		initColorPicker: function(view) {
			if (!view.$el) {
				return;
			}

			var $colorPickerInput = $('.ttfmake-configuration-color-picker', view.$el);
			var colorPickerOptions = {
				change: function(event, ui) {
					var $input = $(event.target);

					if ($input) {
						// pass data to trigger so it can be passed to model
						var data = {
							modelAttr: $input.attr('data-model-attr'),
							color: ui.color.toString()
						};

						$input.trigger('color-picker-change', data);
					}
				}
			};

			// set default color if there's already some color saved
			if ($colorPickerInput.val()) {
				colorPickerOptions.defaultColor = $colorPickerInput.val();
			}

			// init color picker
			$colorPickerInput.wpColorPicker(colorPickerOptions);
			return $colorPickerInput;
		},

		setClearClasses: function ($el) {
			var columns = $('.ttfmake-gallery-columns', $el).val(),
				$items = $('.ttfmake-gallery-item', $el);

			$items.each(function(index, item){
				var $item = $(item);
				if (0 !== index && 0 === index % columns) {
					$item.addClass('clear');
				} else {
					$item.removeClass('clear');
				}
			});
		},

		// Leaving function to avoid errors if 3rd party code uses it. Deprecated in 1.4.0.
		initAllEditors: function() {}
	});

	// Initialize builder view
	oneApp.builder = new MakeBuilder({
		el: '#ttfmake-builder'
	});

	// Initialize menu view
	oneApp.menu = new oneApp.views.menu();

	/**
	 * Attach an event to 'Update' post/page submit to store all the ttfmake-section[] array fields to a single hidden input containing these fields serialized in JSON. Then remove the fields to prevent those from being submitted.
	 */
	$('form#post').on('submit', function(e) {
		var $target					= $(e.target);
		var $sectionInputs	= $target.find('[name^="ttfmake-section["]');
		var $wpPreviewInput = $('input[name=wp-preview]');

		// Only disable inputs when form is actually submitted so it's not triggered on Preview
		if ($wpPreviewInput.val() !== 'dopreview') {
			// Set ttfmake-section[] array fields to disabled and remove name for those to prevent them from being submitted
			$sectionInputs.attr({
				'name': '',
				'disabled': 'true'
			});
		}
	});

	wp.media.view.Sidebar = wp.media.view.Sidebar.extend({
		render: function() {
			this.$el.html( wp.media.template( 'ttfmake-remove-image' ) );
			return this;
		}
	});

	$(document).ready(function() {
		oneApp.builder.render();
	})
})(jQuery, Backbone, oneApp, ttfMakeFrames);
