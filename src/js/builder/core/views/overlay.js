/* global jQuery, _ */
var oneApp = oneApp || {};

(function (window, $, _, oneApp) {
	'use strict';

	oneApp.views = oneApp.views || {};

	// Base overlay
	oneApp.views.overlay = Backbone.View.extend({
		caller: null,

		events: {
			'click .ttfmake-overlay-close-update': 'onUpdate',
			'click .ttfmake-overlay-close-discard': 'onDiscard',
			'click': 'onClick',
		},

		initialize: function() {
			this.model = new Backbone.Model();
		},

		open: function(view) {
			this.caller = view;
			this.model.clear();
			this.$el.css('display', 'table');
			$('body').addClass('modal-open');
		},

		close: function(apply) {
			this.$el.hide();
			$('body').removeClass('modal-open');
		},

		onUpdate: function(e) {
			e.preventDefault();
			this.close(true);
		},

		onDiscard: function(e) {
			e.preventDefault();
			this.close(false);
		},

		onClick: function(e) {
			if ($(e.target).is('.ttfmake-overlay-wrapper')) {
				this.close(false);
			}
		}
	});

	// Content editor overlay
	oneApp.views['tinymce-overlay'] = oneApp.views.overlay.extend({
		keyDownHandler: null,

		open: function(view) {
			oneApp.views.overlay.prototype.open.apply(this, arguments)

			// Auto focus on the editor
			var focusOn = oneApp.builder.$makeTextArea;
			var self = this;

			if (oneApp.builder.isVisualActive()) {
				focusOn = tinyMCE.get('make');

				if (view.model.get('parentID')) {
					var parentModel = _(oneApp.builder.sections.models).findWhere({id: view.model.get('parentID')});

					if (parentModel.get('background-color')) {
						focusOn.getBody().style.backgroundColor = parentModel.get('background-color');
					}
				}
			}

			this.keyDownHandler = _.bind(this.onKeyDown, this)
			focusOn.on('keydown', this.keyDownHandler);
			$('body').on('keydown', this.keyDownHandler);

			focusOn.focus();
			view.$el.trigger('overlay-open', this.$el);
		},

		close: function(apply) {
			var editor = tinyMCE.get('make');

			if (editor) {
				editor.off('keydown', this.keyDownHandler);
				editor.selection.select(editor.getBody(), true);
				editor.selection.collapse(false);
			}

			$('body').off('keydown', this.keyDownHandler);

			oneApp.views.overlay.prototype.close.apply(this, arguments);

			if (apply) {
				oneApp.builder.setTextArea(oneApp.builder.activeTextAreaID);

				if ('' !== oneApp.builder.activeiframeID) {
					oneApp.builder.filliframe(oneApp.builder.activeiframeID);
				}

				this.toggleHasContent();
				var $textarea = $('#' + oneApp.builder.activeTextAreaID);
				var modelAttr = $textarea.data('model-attr');
				this.model.set(modelAttr, $textarea.val());
			}

			this.caller.$el.trigger('overlay-close', this.model.attributes);
			$('body').trigger('scroll');
		},

		toggleHasContent: function(textareaID) {
			textareaID = textareaID || oneApp.builder.activeTextAreaID;

			var link = $('.edit-content-link[data-textarea="' + textareaID + '"]'),
				content = oneApp.builder.getMakeContent();

			if ('' !== content) {
				link.addClass('item-has-content');
			} else {
				link.removeClass('item-has-content');
			}
		},

		onKeyDown: function(e) {
			if (27 == e.keyCode) {
				this.close(false);
			}
		}
	});

	// Section settings overlay
	oneApp.views.settings = oneApp.views.overlay.extend({
		$overlay: null,
		$colorPickers: null,

		events: function() {
			return _.extend({}, oneApp.views.overlay.prototype.events, {
				'change input[type=text]' : 'updateInputField',
				'keyup input[type=text]' : 'updateInputField',
				'change input[type=checkbox]' : 'updateCheckbox',
				'change select': 'updateSelectField',
				'color-picker-change': 'onColorPickerChange',
				'click .ttfmake-media-uploader-add': 'onMediaAdd',
				'mediaSelected': 'onMediaSelected',
				'mediaRemoved': 'onMediaRemoved',
			});
		},

		open: function(view, $overlay) {
			this.render($overlay);
			oneApp.views.overlay.prototype.open.apply(this, arguments);

			$('input, select', this.$el).first().focus();
			$('.wp-color-result', $overlay).click().off('click');
			$( 'body' ).off( 'click.wpcolorpicker' );
			$('body').on('keydown', {self: this}, this.onKeyDown);

			view.$el.trigger('overlay-open', this.$el);
		},

		render: function($overlay) {
			this.$el.remove();
			var $el = $overlay.clone();

			this.applyDOMChanges($overlay, $el);
			$el.removeAttr('id');
			$('body').append($el);

			this.setElement($el);
			this.$colorPickers = oneApp.builder.initColorPicker(this);
			this.$overlay = $overlay;
		},

		close: function(apply) {
			oneApp.views.overlay.prototype.close.apply(this, arguments);

			var changeset = {};

			// Reset color picker inputs
			// to original state
			if (this.$colorPickers) {
				this.$colorPickers.each(function() {
					var $this = $(this);
					$(this).wpColorPicker('close');
					$this.parents('.wp-picker-container').replaceWith($this);
					$this.show();
				});
				this.$colorPickers = null;
			}

			if (apply) {
				this.applyDOMChanges(this.$el, this.$overlay);
				changeset = this.model.attributes;
			}

			$('body').off('keydown', this.onKeyDown);
			this.caller.$el.trigger('overlay-close', changeset);
			this.remove();
		},

		applyDOMChanges: function($source, $destination) {
			// Input fields
			var $sourceInputs = $('[data-model-attr]', $source);

			$sourceInputs.each(function() {
				var $this = $(this);
				var modelAttr = $this.data('model-attr');
				var $destinationInput =  $('[data-model-attr="' + modelAttr + '"]', $destination);

				if ($this.is(':checkbox')) {
					$destinationInput.prop('checked', $this.is(':checked'));
				} else {
					$destinationInput.val($this.val());
				}
			});

			// Background images
			var $sourcePlaceholder = $('.ttfmake-configuration-media-wrap', $source);
			var $destinationPlaceholder = $('.ttfmake-configuration-media-wrap', $destination);
			$destinationPlaceholder.html($sourcePlaceholder.html());
		},

		updateInputField: function(e) {
			var $input				= $(e.target);
			var modelAttrName = $input.attr('data-model-attr');

			if (typeof modelAttrName !== 'undefined') {
				this.model.set(modelAttrName, $input.val());
			}
		},

		updateCheckbox: function(e) {
			var $checkbox = $(e.target);
			var modelAttrName = $checkbox.attr('data-model-attr');

			if (typeof modelAttrName !== 'undefined') {
				if ($checkbox.is(':checked')) {
					this.model.set(modelAttrName, 1);
				} else {
					this.model.set(modelAttrName, 0);
				}
			}
		},

		updateSelectField: function(e) {
			var $select = $(e.target);
			var modelAttrName = $select.attr('data-model-attr');

			if (typeof modelAttrName !== 'undefined') {
				this.model.set(modelAttrName, $select.val());
			}
		},

		onMediaAdd: function(e) {
			e.stopPropagation();
			oneApp.builder.initUploader(this, e.target);
		},

		onMediaSelected: function(e, attachment) {
			e.stopPropagation();
			this.model.set('background-image', attachment.id);
			this.model.set('background-image-url', attachment.url);
		},

		onMediaRemoved: function(e) {
			e.stopPropagation();
			this.model.set('background-image', '');
			this.model.set('background-image-url', '');
		},

		onColorPickerChange: function(e, data) {
			if (data) {
				this.model.set(data.modelAttr, data.color);
			}
		},

		onKeyDown: function(e) {
			if (27 == e.keyCode) {
				e.data.self.close(false);
			}
		},
	});
})(window, jQuery, _, oneApp);