const Log = require("logger");
const fetch = require("node-fetch");
const fs = require("fs");

const PSTrophiesFetcher = function (config, path) {
	const minTimer = 5 * 60 * 1000;
	const profiles = [];
	let reloadTimer = null;
	let reloadInterval = minTimer;
	let friendsReady = function () { };
	let profileReady = function () { };
	let missingToken = function () { };
	let authenticationError = function () { };
	let token;

	if (config.reloadInterval > minTimer) {
		reloadInterval = config.reloadInterval;
	}

	function checkToken() {
		if (typeof token === "undefined") {
			fs.readFile(path + "/token.json", (err, content) => {
				if (typeof content !== "undefined") {
					token = JSON.parse(content);
					getFriends();
				} else {
					if (config.code) {
						authenticate(config.code)
							.then((token) => {
								if (token) {
									getFriends();
								} else {
									authenticationError();
								}
							});
					} else {
						missingToken();
					}
				}
			});
		} else {
			getFriends();
		}
	}

	async function authenticate(code) {
		const url = "https://ca.account.sony.com/api/authz/v3/oauth/token";
		const headers = getAuthHeaders();
		const body = "scope=psn:mobile.v1 psn:clientapp" +
			"&access_type=offline" +
			"&code=" + code +
			"&service_logo=ps" +
			"&ui=pr" +
			"&elements_visibility=no_aclink" +
			"&redirect_uri=com.playstation.PlayStationApp://redirect" +
			"&support_scheme=sneiprls" +
			"&grant_type=authorization_code" +
			"&darkmode=true" +
			"&device_base_font_size=10" +
			"&device_profile=mobile" +
			"&app_context=inapp_ios" +
			"&token_format=jwt";
		const params = {
			method: 'POST',
			body: body,
			headers: headers
		}
		const response = await fetch(url, params);
		if (response.ok) {
			const json = await response.text();
			const data = JSON.parse(json);
			token = {
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				expiresAt: Date.now() + (data.expires_in * 1000),
				refreshExpiresAt: Date.now() + (data.refresh_token_expires_in * 1000),
			}
			const profile = await getMyProfile();
			token.accountId = profile.accountId;
			token.onlineId = profile.onlineId;
			fs.writeFileSync(path + "/token.json", JSON.stringify(token));
			return token;
		} else {
			Log.error("Authenticate Response " + response.status);
			Log.error("Authenticate Response " + response.statusText);
		}
		return null;
	}


	async function refreshAccessToken() {
		const url = "https://ca.account.sony.com/api/authz/v3/oauth/token";
		const headers = getAuthHeaders();
		const body = "scope=psn:mobile.v1 psn:clientapp" +
			"&refresh_token=" + token.refreshToken +
			"&token_format=jwt" +
			"&grant_type=refresh_token";
		const params = {
			method: 'POST',
			body: body,
			headers: headers
		}
		const response = await fetch(url, params);
		if (response.ok) {
			const json = await response.text();
			const data = JSON.parse(json);
			const oid = token.onlineId;
			const aid = token.accountId;
			token = {
				onlineId: oid,
				accountId: aid,
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				expiresAt: Date.now() + (data.expires_in * 1000),
				refreshExpiresAt: Date.now() + (data.refresh_token_expires_in * 1000),
			}
			fs.writeFileSync(path + "/token.json", JSON.stringify(token));
		} else {
			Log.error("Refresh Token Response " + response.status);
			Log.error("Refresh Token Response " + response.statusText);
		}
	}

	async function getMyProfile() {
		const profile = {}
		const url = "https://us-prof.np.community.playstation.net/userProfile/v1/users/me/profile2?fields=accountId,@default"
		const headers = getHeaders();
		const response = await fetch(url, { headers: headers });
		if (response.ok) {
			const json = await response.text();
			const ids = JSON.parse(json);
			profile.onlineId = ids.profile.onlineId;
			profile.accountId = ids.profile.accountId;
		} else {
			// fixme 401??
			Log.error("My Profile Response " + response.status);
			Log.error("My Profile Response " + response.statusText);
		}
		return profile;
	}

	const getFriends = () => {
		getFriendsList()
			.then((friendsList) => {
				getProfiles(friendsList)
					.then((friends) => {
						profiles.length = 0;
						friends.forEach(profile => {
							if (profile.accountId == token.accountId) {
								profileReady(profile);
							} else {
								profiles.push(profile);
							}
						});
					})
					.finally(() => {
						scheduleTimer();
						friendsReady(profiles)
					});

			})
	}

	async function getFriendsList() {
		const friendsList = [];
		friendsList.push(token.accountId);
		let offset = 0;
		let limit = 50;
		let loop = true;
		while (loop) {
			const valid = await validateToken();
			if (valid) {
				const headers = getHeaders();
				const url = "https://m.np.playstation.net/api/userProfile/v1/internal/users/" + token.accountId + "/friends?offset=" + offset + "&limit=" + limit;
				const response = await fetch(url, { headers: headers });
				if (response.ok) {
					const json = await response.text();
					const friends = JSON.parse(json);
					friends.friends.forEach(friend => {
						friendsList.push(friend)
					});
					if (typeof friends.nextOffset === "undefined") {
						loop = false;
					} else {
						offset = friends.nextOffset;
					}
				} else {
					// fixme 401??
					Log.error("Friends Response " + response.status);
					Log.error("Friends Response " + response.statusText);
					loop = false;
				}
			} else {
				loop = false;
			}
		}
		return friendsList;
	}

	async function getProfiles(profilesList) {
		const valid = await validateToken();
		const profiles = [];
		if (valid) {
			const url = "https://m.np.playstation.net/api/userProfile/v1/internal/users/profiles?accountIds=" + profilesList
			const headers = getHeaders();
			const response = await fetch(url, { headers: headers });
			if (response.ok) {
				const json = await response.text();
				const users = JSON.parse(json);
				let ix = 0;
				users.profiles.forEach(user => {
					const profile = {
						isPlus: user.isPlus,
						onlineId: user.onlineId,
						hasName: false,
						hasPersonalImage: false
					}
					user.avatars.forEach(imageUrl => {
						if (imageUrl.size == "l") {
							profile.avatar = imageUrl.url;
						}
					});
					if (typeof user.personalDetail !== "undefined") {
						if (typeof user.personalDetail.firstName !== "undefined" &&
							typeof user.personalDetail.lastName !== "undefined") {
							profile.hasName = true;
							profile.name = user.personalDetail.firstName + " " + user.personalDetail.lastName;
						}
						if (typeof user.personalDetail.profilePictures !== "undefined") {
							user.personalDetail.profilePictures.forEach(imageUrl => {
								if (imageUrl.size == "l") {
									profile.hasPersonalImage = true;
									profile.personalImage = imageUrl.url;
								}
							});
						}
					}
					profile.accountId = profilesList[ix];
					profiles.push(profile);
					ix++;
				});
				const presences = await getPresences(profilesList);
				if (presences.size > 0) {
					profiles.forEach(profile => {
						profile.presence = presences.get(profile.accountId);
					});
				}
			} else {
				// fixme 401??
				Log.error("Profiles Response " + response.status);
				Log.error("Profiles Response " + response.statusText);
				loop = false;
			}
		}
		return profiles;
	}

	async function getPresences(profilesList) {
		const valid = await validateToken();
		const presences = new Map();
		if (valid) {
			const url = "https://m.np.playstation.net/api/userProfile/v1/internal/users/basicPresences?type=primary&accountIds=" + profilesList
			const headers = getHeaders();
			const response = await fetch(url, { headers: headers });
			if (response.ok) {
				const json = await response.text();
				const users = JSON.parse(json);
				const presence = {};
				users.basicPresences.forEach(basicPresence => {
					const presence = {
						availability: basicPresence.availability,
						status: basicPresence.primaryPlatformInfo.onlineStatus,
						hasGame: false
					}
					if (typeof basicPresence.gameTitleInfoList !== "undefined") {
						presence.hasGame = true;
						presence.game = basicPresence.gameTitleInfoList[0].titleName + " - " + basicPresence.primaryPlatformInfo.platform;
						presence.gameStatus = basicPresence.gameTitleInfoList[0].gameStatus;
					}
					presences.set(basicPresence.accountId, presence);
				});
			} else {
				// fixme 401??
				Log.error("Presences Response " + response.status);
				Log.error("Presences Response " + response.statusText);
				loop = false;
			}
		}
		return presences;
	}

	function getHeaders() {
		return {
			"Accept-Language": "en-US",
			"User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.131 Safari/537.36",
			"Authorization": "Bearer " + token.accessToken
		};
	}

	function getAuthHeaders() {
		return {
			"Accept-Language": "en-US",
			"User-Agent": "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.131 Safari/537.36",
			"Authorization": "Basic YWM4ZDE2MWEtZDk2Ni00NzI4LWIwZWEtZmZlYzIyZjY5ZWRjOkRFaXhFcVhYQ2RYZHdqMHY=",
			"Content-Type": "application/x-www-form-urlencoded"
		};
	}

	this.startFetch = function () {
		checkToken();
	};

	const scheduleTimer = function () {
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function () {
			getFriends();
		}, reloadInterval);
	};

	this.setReloadInterval = function (interval) {
		if (interval > 1000 && interval < reloadInterval) {
			reloadInterval = interval;
		}
	};

	async function validateToken() {
		if (typeof token === "undefined") {
			Log.error("Token no present");
		} else if (typeof token.accessToken === "undefined") {
			Log.error("Token present but not access token");
		} else if (token.expiresAt < Date.now()) {
			Log.error("Token expired at " + new Date(token.expiresAt));
			if (token.refreshExpiresAt < Date.now()) {
				Log.error("Refresh Token expired at " + new Date(token.refreshExpiresAt));
				// fixme
			} else {
				await refreshAccessToken();
			}
		} else {
			return true;
		}
		return false;
	}

	this.onMissingToken = function (callback) {
		missingToken = callback;
	};

	this.onAuthenticationError = function (callback) {
		authenticationError = callback;
	};

	this.onFriendsReady = function (callback) {
		friendsReady = callback;
	};

	this.onProfileReady = function (callback) {
		profileReady = callback;
	};

	this.onError = function (callback) {
		fetchFailedCallback = callback;
	};

	this.url = function () {
		return url;
	};

	this.profiles = function () {
		return profiles;
	};
};

module.exports = PSTrophiesFetcher;
