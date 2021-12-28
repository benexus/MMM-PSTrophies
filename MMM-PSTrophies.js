Module.register("MMM-PSTrophies", {
	defaults: {
		debug: true,
		code: null,
		reloadInterval: 5 * 60 * 1000,
		pageUpdateInterval: 10 * 1000,
		pageSize: 5,
		animationSpeed: 1000
	},

	page: 1,
	start: 0,
	pages: [],
	profile: null,

	getScripts: function () {
		return ["moment.js"];
	},

	getStyles: function () {
		return ["pstrophies.css"];
	},

	getTranslations: function () {
		return false;
	},

	getHeader: function () {
		if (this.profile) {
			let name = this.profile.onlineId
			let avatar = this.profile.avatar;
			if (this.profile.hasName) {
				name = this.profile.name;
			}
			if (this.profile.hasPersonalImage) {
				avatar = this.profile.personalImage;
			}
			return "<div><img width=32 height=32 style='border-radius: 50%;' src='" + avatar + "'/>" + name + "</div>";
		}
		return "PS Trophies";
	},

	start: function () {
		moment.locale(config.language);

		this.profiles = [];
		this.loaded = false;
		this.empty = false;
		this.error = null;
		this.missingToken = false;
		this.authError = false;

		this.sendSocketNotification("CREATE_FETCHER", {
			config: this.config
		});
	},

	socketNotificationReceived: function (notification, payload) {
		this.error = null;
		this.missingToken = false;
		this.authError = false;
		if (notification === "MISSING_TOKEN") {
			this.missingToken = true;
		} else if (notification === "AUTHENTICATION_ERROR") {
			this.authError = true;
		} else if (notification === "PROFILE_AVAILABLE") {
			this.profile = payload;
		} else if (notification === "FRIENDS_AVAILABLE") {
			this.generateList(payload);
			this.page = 1;
			this.loaded = true;
			this.timer = null;
		} else if (notification === "PROFILE_READY") {
			this.profile = payload
		} else if (notification === "PS_ERROR") {
			this.error = this.translate(payload.error_type);
		}
		this.updateDom(this.config.animationSpeed);
	},

	getTemplate: function () {
		return "pstrophies.njk";
	},

	getTemplateData: function () {
		this.empty = this.profiles.length == 0;
		this.start = this.page * this.config.pageSize;
		let totalPages = Math.ceil(this.profiles.length / this.config.pageSize);
		this.pages.length = 0;
		if (this.profiles.length > 0) {
			this.page++;
		}
		if (this.start >= this.profiles.length) {
			this.page = 1;
			this.start = 0;
		}
		if (totalPages > 1) {
			for (let i = 1; i < totalPages + 1; i++) {
				this.pages.push(i == this.page)
			}
			if (!this.timer) {
				this.schedulePageUpdateInterval();
			}
		}
		return {
			loaded: this.loaded,
			error: this.error,
			missingToken: this.missingToken,
			empty: this.empty,
			config: this.config,
			authError: this.authError,
			profiles: this.profiles.slice(this.start, this.start + this.config.pageSize),
			pages: this.pages
		};
	},

	generateList: function (friends) {
		this.profiles.length = 0;
		friends.forEach(friend => {
			if (friend.presence.status == "online") {
				this.profiles.push(friend);
			}
		});
	},

	schedulePageUpdateInterval: function () {
		this.timer = setInterval(() => {
			this.updateDom(this.config.animationSpeed);
		}, this.config.pageUpdateInterval);
	},

});