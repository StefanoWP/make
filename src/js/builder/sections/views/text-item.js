/* global Backbone, jQuery, _ */
var oneApp = oneApp || {};

(function (window, Backbone, $, _, oneApp) {
	'use strict';

	oneApp.views = oneApp.views || {}

	oneApp.views['text-item'] = oneApp.views.item.extend({
		el: '',
		elSelector: '',
		className: 'ttfmake-text-column',

		events: function() {
			return _.extend({}, oneApp.views.item.prototype.events, {
				'column-load': 'onColumnLoad',
				'overlay-open': 'onOverlayOpen',
				'click .ttfmake-text-column-remove': 'onColumnRemove',
				'overlay-close': 'onOverlayClose'
			});
		},

		initialize: function (options) {
			this.template = _.template(ttfMakeSectionTemplates['text-item'], oneApp.builder.templateSettings);
		},

		render: function () {
			var self = this;

			var html = this.template(this.model);
			this.setElement(html);

			return this;
		},

		onColumnLoad: function() {
			var self = this;

			$('iframe', this.$el).ready(function() {
				setTimeout(function() {
					self.updateIframeHeight();
				}, 150);
			});

			// update again - this is for browsers not detecting iframe ready before window load
			$(window).load(function() {
				self.updateIframeHeight();
			});
		},

		onOverlayOpen: function (e, $overlay) {
			e.stopPropagation();

			var $button = $('.ttfmake-overlay-close-update', $overlay);
			$button.text('Update column');
		},

		onOverlayClose: function(e, changeset) {
			e.stopPropagation();

			this.model.set(changeset);

			if (this.model.hasChanged()) {
				if ('' !== this.model.get('content')) {
					this.$el.find('.ttfmake-iframe-content-placeholder').removeClass('show');
				} else {
					this.$el.find('.ttfmake-iframe-content-placeholder').addClass('show');
				}

				this.$el.trigger('model-item-change');
			}

			this.updateIframeHeight();
		},

		updateIframeHeight: function() {
			var $iframe = this.$el.find('iframe');

			var self = this;

			setTimeout(function() {
				if (self.model.get('content')) {
					$iframe.height($iframe.contents().height());

					var iframeContentHeight = $iframe.contents().innerHeight();

					if (iframeContentHeight > 500) {
						iframeContentHeight = 500;
					}

					if (iframeContentHeight <= 300) {
						iframeContentHeight = 300;
					}

					$iframe.innerHeight(iframeContentHeight);

					if ('' !== self.model.get('content')) {
						self.$el.find('.ttfmake-iframe-content-placeholder').removeClass('show');
					} else {
						self.$el.find('.ttfmake-iframe-content-placeholder').addClass('show');
					}
				} else {
					$iframe.innerHeight(300);
				}
			}, 100);
		},

		onColumnRemove: function(evt) {
			evt.preventDefault();

			if (!confirm('Are you sure you want to trash this column permanently?')) {
				return;
			}

			var $stage = this.$el.parents('.ttfmake-text-columns-stage');

			this.$el.animate({
				opacity: 'toggle',
				height: 'toggle'
			}, oneApp.builder.options.closeSpeed, function() {
				this.$el.trigger('column-remove', this);
				this.remove();
			}.bind(this));
		},
	});
})(window, Backbone, jQuery, _, oneApp);
