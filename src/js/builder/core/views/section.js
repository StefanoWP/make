/* global Backbone, jQuery, _, wp:true */
var oneApp = oneApp || {};

(function (window, Backbone, $, _, oneApp) {
	'use strict';

	oneApp.views = oneApp.views || {};

	oneApp.views.section = Backbone.View.extend({
		template: '',
		className: 'ttfmake-section',
		$headerTitle: '',
		serverRendered: false,
		$document: $(window.document),
		$scrollHandle: $('html, body'),

		events: {
			'click .ttfmake-section-toggle': 'toggleSection',
			'click .ttfmake-section-remove': 'removeSection',
			'click .ttfmake-media-uploader-add': 'onMediaAdd',
			'click .ttfmake-overlay-open': 'openConfigurationOverlay',
			'overlay-close': 'onOverlayClose',
			'mediaSelected': 'onMediaSelected',
			'mediaRemoved': 'onMediaRemoved',
		},

		initialize: function (options) {
			this.template = _.template(ttfMakeSectionTemplates[this.model.get('section-type')], oneApp.builder.templateSettings);

			this.model.bind('change', function() {
				$('[name^="ttfmake-section-json"]', this.$el).val(JSON.stringify(this.model.toJSON()));
			}, this);
		},

		render: function () {
			var html = this.template(this.model);
			this.setElement(html);
			this.$headerTitle = $('.ttfmake-section-header-title', this.$el);

			return this;
		},

		toggleSection: function (evt) {
			evt.preventDefault();

			var self = this;

			var $this = $(evt.target),
				$section = $this.parents('.ttfmake-section'),
				$sectionBody = $('.ttfmake-section-body', $section);

			if ($section.hasClass('ttfmake-section-open')) {
				$sectionBody.slideUp(oneApp.builder.options.closeSpeed, function() {
					$section.removeClass('ttfmake-section-open');
					self.model.set('state', 'closed');
				});
			} else {
				$sectionBody.slideDown(oneApp.builder.options.openSpeed, function() {
					$section.addClass('ttfmake-section-open');
					self.model.set('state', 'open');
				});
			}
		},

		removeSection: function (evt) {
			evt.preventDefault();

			// Confirm the action
			if (false === window.confirm(ttfmakeBuilderData.confirmString)) {
				return;
			}

			// Fade and slide out the section, then cleanup view and reset stage on complete
			this.$el.animate({
				opacity: 'toggle',
				height: 'toggle'
			}, oneApp.builder.options.closeSpeed, function() {
				oneApp.builder.sections.remove(this.model);
				this.remove();
				oneApp.builder.toggleStageClass();
				oneApp.builder.$el.trigger('afterSectionViewRemoved', this);
			}.bind(this));
		},

		onMediaAdd: function(e) {
			e.preventDefault();
			e.stopPropagation();

			oneApp.builder.initUploader(this, e.target);
		},

		onMediaSelected: function(e, attachment) {
			this.model.set('background-image', attachment.id);
			this.model.set('background-image-url', attachment.url);
		},

		onMediaRemoved: function(e) {
			e.stopPropagation();

			this.model.unset('background-image');
			this.model.unset('background-image-url');
		},

		openConfigurationOverlay: function (e) {
			e.preventDefault();

			var $this = $(e.target);
			var $overlay = $($this.attr('data-overlay'));
			oneApp.builder.settingsOverlay.open(this, $overlay);
		},

		onOverlayClose: function(e, changeset) {
			e.stopPropagation();

			if ('title' in changeset) {
				this.$headerTitle.html(_.escape(changeset['title']));

				if (changeset['title']) {
					this.$el.find('.ttfmake-section-header h3').addClass('has-title');
				} else {
					this.$el.find('.ttfmake-section-header h3').removeClass('has-title');
				}
			}

			$('.ttfmake-iframe-wrapper', this.$el).css('background-color', changeset['background-color'] || '');

			this.model.set(changeset);
		},

		closeConfigurationOverlay: function (evt) {
			evt.preventDefault();

			var $this = $(evt.target),
				$overlay = $this.parents('.ttfmake-overlay');

			$overlay.hide();
		},
	});
})(window, Backbone, jQuery, _, oneApp);
