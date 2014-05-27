/*
 * RESTo
 * 
 * RESTo - REstful Semantic search Tool for geOspatial 
 * 
 * Copyright 2013 Jérôme Gasperi <https://github.com/jjrom>
 * 
 * jerome[dot]gasperi[at]gmail[dot]com
 * 
 * 
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 * 
 */
(function(window) {

    window.R = window.R || {};

    /**
     * Create RESTo javascript object
     */
    window.R = {
        
        VERSION_NUMBER: 'RESTo 1.0',
        
        /*
         * Translation array
         */
        translation: {},
        
        /*
         * RESTO URL
         */
        restoUrl: null,
        
        /*
         * Result layer
         */
        layer: null,
        
        /*
         * SSO authentication services
         */
        ssoServices: {},
        
        /*
         * User profile
         */
        userProfile: null,
        
        /*
         * User rights for collection
         */
        userRights: null,
        
        /*
         * Initialize RESTo
         * 
         * @param {Object} options
         */
        init: function(options) {

            var timer, self = this;

            options = options || {};

            self.translation = options.translation || {};
            self.restoUrl = options.restoUrl;
            
            /*
             * SSO authentication server is available
             */
            self.ssoServices = options.ssoServices || {};
            
            /*
             * mapshup is defined
             */
            if (window.M) {

                /*
                 * mapshup bug ?
                 * Force map size refresh when user scroll RESTo page
                 */
                $('#resto-container').bind('scroll', function() {
                    clearTimeout(timer);
                    timer = setTimeout(function() {
                        window.M.events.trigger('resizeend');
                    }, 150);
                });
              
                /*
                 * Display GeoJSON data within mapshup on startup
                 * 
                 * Note : setInterval function is needed to ensure that mapshup map
                 * is loaded before sending the GeoJSON feed
                 */
                if (options.data) {
                    var fct = setInterval(function() {
                        if (window.M.Map.map && window.M.isLoaded) {
                            
                            self.initSearchLayer(options.data, options.data.query && options.data.query.hasLocation ? true : false);
                            
                            /*
                             * Display full size WMS
                             */
                            if (options.singleResource) {
                                if (self.layer) {
                                    window.M.Map.zoomTo(self.layer.getDataExtent(), false);
                                    if ($.isArray(options.data.features) && options.data.features[0]) {
                                        if (options.data.features[0].properties['services']['browse'] && options.data.features[0].properties['services']['browse']['layer']) {
                                            M.Map.addLayer({
                                                title: options.data.features[0].id,
                                                type: options.data.features[0].properties['services']['browse']['layer']['type'],
                                                layers: options.data.features[0].properties['services']['browse']['layer']['layers'],
                                                url: options.data.features[0].properties['services']['browse']['layer']['url'].replace('%5C', '')
                                            });
                                        }
                                    }
                                }
                            }
                            
                            /*
                             * Add "Center on layer" action
                             */
                            (new M.Toolbar({
                                position: 'nw',
                                orientation: 'h'
                            })).add({
                                title: '<span class="fa fa-map-marker"></span>',
                                tt: "Center",
                                onoff: false,
                                onactivate: function(scope, item) {
                                    item.activate(false);
                                    if (self.layer && self.layer.features && self.layer.features.length > 0) {
                                        window.M.Map.zoomTo(self.layer.getDataExtent(), false);
                                    }
                                }
                            });
                    
                            clearInterval(fct);
                        }
                    }, 500);
                }
            }

            /*
             * Update bbox parameter in href attributes of all element with 'resto-updatebbox' class
             */
            if (window.M) {
                var uFct = setInterval(function() {
                    if (window.M.Map.map && window.M.isLoaded) {
                        window.M.Map.events.register("moveend", self, function(map, scope) {
                            scope.updateBBOX();
                        });
                        self.updateBBOX();
                        clearInterval(uFct);
                    }
                }, 500);
            }

            /*
             * Update searchForm input
             */
            $("#resto-searchform").submit(function(e) {
                e.preventDefault();
                /*
                 * Bound search to map view
                 */
                window.History.pushState({randomize: window.Math.random()}, null, '?' + $(this).serialize() + (window.M && $('#mapshup').visible() ? '&box=' + window.M.Map.Util.p2d(M.Map.map.getExtent()).toBBOX() : ''));
            });

            /*
             * Set the toolbar actions
             */
            self.updateRestoToolbar();

            /*
             * Set the admin actions
             */
            self.Admin.updateAdminActions(options.collection);

            /*
             * Force focus on search input form
             */
            $('#search').focus();

        },
        
        /**
         * Bind history state change
         * 
         * @param {function} callback // callback function to call on state change
         * 
         */
        onHistoryChange: function(callback) {
            
            var self = this;
            
            /*
             * State change - Ajax call to RESTo backend server
             */
            window.History.Adapter.bind(window, 'statechange', function() {

                // Be sure that json is called !
                var state = window.History.getState(), url = self.updateURL(state.cleanUrl, {format: 'json'});

                self.showMask();

                $.ajax({
                    url: url,
                    async: true,
                    dataType: 'json',
                    success: function(json) {
                        self.hideMask();
                        if (typeof callback === 'function') {
                            callback(json, {
                                updateMap:true,
                                centerMap:(state.data && state.data.centerMap) || (json.query && json.query.hasLocation) ? true : false
                            });
                        }
                    },
                    error: function(e) {
                        self.hideMask();
                        self.message("Connection error");
                    }
                });
            });

        },
        
        /**
         * Set the RESTo toolbar actions
         */
        updateRestoToolbar: function() {

            var self = this;

            /*
             * Share on facebook
             */
            $('.shareOnFacebook').click(function() {
                window.open('https://www.facebook.com/sharer.php?u=' + encodeURIComponent(window.History.getState().cleanUrl) + '&t=' + encodeURIComponent($('#search').val()));
                return false;
            });

            /*
             * Share to twitter
             */
            $('.shareOnTwitter').click(function() {
                window.open('http://twitter.com/intent/tweet?status=' + encodeURIComponent($('#search').val() + " - " + window.History.getState().cleanUrl));
                /*
                 * TODO use url shortener supporting CORS
                 * 
                 self.showMask();
                 self.ajax({
                 url:'http://tinyurl.com/api-create.php?url=' + encodeURIComponent(window.History.getState().cleanUrl),
                 success: function(txt) {
                 self.hideMask();
                 window.open('http://twitter.com/intent/tweet?status='+encodeURIComponent($('#search').val() + " - " + txt));
                 },
                 error: function(e) {
                 self.hideMask();
                 self.message('Error - cannot share on twitter');
                 }
                 });
                 */
                return false;
            });

            /*
             * Display Atom feed
             */
            $('.displayRSS').click(function() {
                window.location = self.updateURL(window.History.getState().cleanUrl, {format: 'json'});
                return false;
            });

            /*
             * Display profile or login action
             * depending if connected or not 
             */
            self.ajax({
                url: self.restoUrl + 'auth/getProfile.php',
                dataType:'json',
                success: function(json) {
                    self.userProfile = json;
                    self.userRights = self.userProfile['collections'] && self.userProfile['collections'][self.collection] ? $.extend(self.userProfile['rights']['default'], self.userProfile['collections'][self.collection]) : self.userProfile['rights']['default']; 
                    self.updateConnectionInfo();
                    self.hideMask();
                },
                error: function(e) {
                    self.hideMask();
                }
            });
            
            /*
             * Display user panel
             */
            $('.viewUserPanel').click(function(){
                self.showUserPanel();
            });
            
        },
        
        /**
         * Show/hide connection info in toolbar
         */
        updateConnectionInfo: function() {
            if (this.isConnected()) {
                $('.viewUserPanel')
                        .html('')
                        .attr('title', this.userProfile.email)
                        .css('background-image', 'url(' + this.getGravatar(this.userProfile.userhash, 200) + ')');
            }
            else {
                $('.viewUserPanel')
                        .html('<span class="fa fa-sign-in"></span>')
                        .attr('title', this.translate('_login'))
                        .css('background-image', 'auto');
            }
        },
        
        /**
         * Show mask overlay (during loading)
         */
        showMask: function() {
            $('<div id="resto-mask-overlay"><span class="fa fa-3x fa-refresh fa-spin"></span></div>').appendTo($('body')).css({
                'position': 'fixed',
                'z-index': '100000',
                'top': '0px',
                'left': '0px',
                'background-color': 'rgba(128, 128, 128, 0.7)',
                'color': 'white',
                'text-align': 'center',
                'width': '100%',
                'height': '100%',
                'line-height': $(window).height() + 'px'
            }).show();
        },
        
        /**
         * Clear mask overlay
         */
        hideMask: function() {
            $('#resto-mask-overlay').remove();
        },
        
        /**
         * Replace {a:1}, {a:2}, etc within str by array values
         * 
         * @param {string} str (e.g. "My name is {a:1} {a:2}")
         * @param {array} values (e.g. ['Jérôme', 'Gasperi'])
         * 
         */
        translate: function(str, values) {

            if (!this.translation || !this.translation[str]) {
                return str;
            }

            var i, l, out = this.translation[str];

            /*
             * Replace additional arguments
             */
            if (values && out.indexOf('{a:') !== -1) {
                for (i = 0, l = values.length; i < l; i++) {
                    out = out.replace('{a:' + (i + 1) + '}', values[i]);
                }
            }

            return out;
        },
        /**
         * Update key/value parameters from url by values
         * 
         * @param {string} url (e.g. 'http://localhost/resto/?format=json)
         * @param {object} params (e.g. {format:'html'})
         * 
         */
        updateURL: function(url, params) {

            var key, value, i, l, sourceParamsList, sourceParams = {}, newParamsString = "", sourceBase = url.split("?")[0];

            try {
                sourceParamsList = url.split("?")[1].split("&");
            }
            catch (e) {
                sourceParamsList = [];
            }
            for (i = 0, l = sourceParamsList.length; i < l; i++) {
                key = sourceParamsList[i].split('=')[0];
                value = sourceParamsList[i].split('=')[1];
                if (key) {
                    sourceParams[key] = value ? value : '';
                }
            }

            for (key in params) {
                sourceParams[key] = params[key];
            }

            for (key in sourceParams) {
                newParamsString += key + "=" + sourceParams[key] + "&";
            }

            return sourceBase + "?" + newParamsString;
        },
        /**
         * Post to mapshup
         * 
         * @param {string/object} json
         */
        addLayer: function(json) {

            if (!window.M) {
                return null;
            }

            if (typeof json === 'string') {
                json = JSON.parse(decodeURI(json));
            }

            return window.M.Map.addLayer(json, {
                noDeletionCheck: true
            });

        },
        /**
         * Initialize search result layer
         */
        initSearchLayer: function(json, centerMap) {
            this.layer = this.addLayer({
                type: 'GeoJSON',
                clusterized: false,
                data: json,
                zoomOnNew: centerMap ? 'always' : false,
                MID: '__resto__',
                color: '#FFF1FB',
                featureInfo: {
                    noMenu: true,
                    onSelect: function(f) {
                        if (f && f.fid) {

                            /*
                             * Unhilite all features before scrolling
                             * to the right one
                             */
                            window.M.Map.featureInfo.unhilite(window.M.Map.featureInfo.hilited);

                            /*
                             * Remove the height of the map to scroll
                             * to the element
                             */
                            var delta = 0;
                            if ($('#mapshup-tools').length > 0) {
                                delta = $('#mapshup-tools').position().top + $('#mapshup-tools').height();
                            }

                            /*
                             * Search for feature in result entries
                             */
                            $('.resto-entry').each(function() {

                                if ($(this).attr('fid') === f.fid) {
                                    $(this).addClass('selected');
                                    $('html, body').animate({
                                        scrollTop: ($(this).offset().top - delta)
                                    }, 500);
                                    return false;
                                }

                            });

                        }
                    },
                    onUnselect: function(f) {
                        $('.resto-entry').each(function() {
                            $(this).removeClass('selected');
                        });
                    }
                }
            });

        },
        /**
         * Return type from mimeType
         * 
         * @param {string} mimeType
         */
        mimeToType: function(mimeType) {
            switch (mimeType) {
                case 'application/json':
                    return 'GeoJSON';
                    break;
                case 'application/atom+xml':
                    return 'ATOM';
                    break;
                case 'text/html':
                    return 'HTML';
                    break;
                default:
                    return mimeType;
            }
        },
        /**
         * Add map bounding box in EPSG:4326 to all element with a 'resto-updatebbox' class
         */
        updateBBOX: function() {
            var box;    
            if (window.M && window.M.Map.map) {
                if ($('#mapshup').visible()) {
                    box = window.M.Map.Util.p2d(window.M.Map.map.getExtent()).toBBOX();
                    $('.resto-updatebbox').each(function() {
                        $(this).attr('href', window.M.Util.extendUrl($(this).attr('href'), {
                            box: box
                        }));
                    });
                }
                else {
                    $('.resto-updatebbox').each(function() {
                        $(this).attr('href', window.M.Util.extendUrl($(this).attr('href'), {
                            box:null
                        }));
                    });
                }
            }
        },
        
        /**
         * Return textual resolution from value in meters
         * 
         * @param {integer} value
         */
        getResolution: function(value) {

            if (!$.isNumeric(value)) {
                return null;
            }

            if (value <= 2.5) {
                return 'THR';
            }

            if (value > 2.5 && value <= 30) {
                return 'HR';
            }

            if (value > 30 && value <= 500) {
                return 'MR';
            }

            return 'LR';

        },
        
        /**
         * Get gravatar icon url
         * 
         * See http://en.gravatar.com
         * 
         * @param emailhash : md5 hash of an email adress
         * @param size : size of the returned icon in pixel
         */
        getGravatar: function(emailhash, size) {
            return 'http://www.gravatar.com/avatar/' + (emailhash ? emailhash : '') + '?d=mm' + (!size || !$.isNumeric(size) ? '' : '&s=' + size);
        },

        /**
         * Launch an ajax call
         * This function relies on jquery $.ajax function
         * 
         * @param {Object} obj
         * @param {boolean} showMask
         */
        ajax: function(obj, showMask) {

            var self = this;

            /*
             * Paranoid mode
             */
            if (typeof obj !== "object") {
                return null;
            }

            /*
             * Ask for a Mask
             */
            if (showMask) {
                obj['complete'] = function(c) {
                    self.hideMask();
                };
                self.showMask();
            }

            return $.ajax(obj);

        },
        /**
         * Display non intrusive message to user
         * 
         * @param {string} message
         * @param {integer} duration
         */
        message: function(message, duration) {
            var $container = $('body'), $d;
            $container.append('<div class="adminMessage"><div class="content">' + message + '</div></div>');
            $d = $('.adminMessage', $container);
            $d.fadeIn('slow').delay(duration || 2000).fadeOut('slow', function() {
                $d.remove();
            }).css({
                'left': ($container.width() - $d.width()) / 2,
                'top': 60
            });
            return $d;

        },
        
        /**
         * Display user panel
         */
        showUserPanel: function() {
            
            var self = this, $userPanel;
            
            /*
             * User panel is displayed on top of RESTo content
             */
            $userPanel = $('<div id="restoUserPanel"><div class="close" title="' + self.translate('_close') + '"></div></div>').appendTo($('body')).show();
            
            /*
             * Top-right close button to hide user panel
             */
            $('.close', $userPanel).click(function(){
                self.hideUserPanel();
            });
            
            /*
             * The user is connected (i.e. authenticated)
             * Display user profile and logout button
             */
            if (self.isConnected()) {
                self.displayProfile();
            }
            /*
             * The user is not connected (i.e. not authenticated)
             * Display login/password form and sign with SSO / register buttons
             */
            else {
                self.displayLogin();
            }
        },
        
        /**
         * Hide user panel
         */
        hideUserPanel: function() {
            $('#restoUserPanel').remove();
        },
        
        /**
         * Return true if user is connected (i.e. authenticated)
         */
        isConnected: function() {
            if (this.userProfile && this.userProfile.userid && this.userProfile.userid !== -1) {
                return true;
            }
            return false;
        },
        
        /**
         * Display user profile in user panel
         */
        displayProfile: function() {
            
            var self = this, $userPanel = $('#restoUserPanel');
            
            $userPanel.append('<div class="row"><div class="large-12 columns"><img src="' + self.getGravatar(this.userProfile.userhash, 200) + '"/><ul class="no-bullet"><li>' + self.userProfile.email + '</li></ul><a class="button signOut">' + self.translate('_logout') + '</a></div></div>');
            $('.signOut').click(function() {
                self.showMask();
                self.ajax({
                    url: self.restoUrl + 'auth/disconnect.php',
                    dataType:'json',
                    success: function(json) {
                        window.location.reload();
                    },
                    error: function(e) {
                        self.hideMask();
                        self.hideUserPanel();
                        self.message('Error : cannot disconnect');
                    }
                });
                return false;
            });
        },
        
        /**
         * Display login form in user panel
         */
        displayLogin: function() {
            
            var key, self = this, $userPanel = $('#restoUserPanel');
            
            /*
             * Remove register panel
             */
            $('#displayRegister').remove();
            
            /*
             * Display login panel
             */
            $userPanel.append('<div class="row" id="displayLogin"><div class="large-12 columns"><form action="#"><ul class="no-bullet"><li><input id="userEmail" type="text" placeholder="' + self.translate('_email') + '"/></li><li><input id="userPassword" type="password" placeholder="' + self.translate('_password') + '"/></li></ul><p><a class="button signIn">' + self.translate('_login') + '</a></p><div class="signWithOauth"></div><p><a class="register">' + self.translate('_createAccount') + '</a></p></form></div></div>');
            $('#userEmail').focus();
            $('#userPassword').keypress(function (e) {
                if (e.which === 13) {
                    $('.signIn').trigger('click');
                    return false;
                }
            });
            
            /*
             * Register user locally
             */
            $('.register').click(function(e){
                e.preventDefault();
                self.displayRegister();
                return false;
            });
            
            /*
             * Sign in locally
             */
            $('.signIn').click(function(e) {
                e.preventDefault();
                self.showMask();
                self.ajax({
                    url: self.restoUrl + 'auth/connect.php',
                    headers: {
                        'Authorization': "Basic " + btoa($('#userEmail').val() + ":" + $('#userPassword').val())
                    },
                    dataType:'json',
                    success: function(json) {
                        if (json && json.userid === -1) {
                            self.hideMask();
                            self.message('Error - unknown user or incorrect password');
                        }
                        else {
                            window.location.reload();
                        }
                    },
                    error: function(e) {
                        self.hideMask();
                        self.message('Error - cannot sign in');
                    }
                });
                return false;
            });
            
            /*
             * Sign in using SSO Oauth server - e.g. Google
             */
            for (key in self.ssoServices) {
                (function(key) { 
                    $('.signWithOauth').append('<p><a id="_oauth' + key + '">' + self.translate('_signWithOauth', [key]) + '</a></p>');
                    $('#_oauth' + key).click(function(e) {

                        /*
                         * Open SSO authentication window
                         */
                        var popup = window.open(self.ssoServices[key].authorizeUrl, key, 'dependent=yes, menubar=yes, toolbar=yes');

                        /*
                         * Load user profile after popup has been closed
                         */
                        var fct = setInterval(function() {
                            if (popup.closed) {
                                clearInterval(fct);
                                window.location.reload();
                            }
                        }, 200);

                    });
                })(key);
            }
        },
        
        /**
         * Display account creation in user panel
         */
        displayRegister: function() {
            
            var self = this, bottomContent, leftContent, rightContent, $userPanel = $('#restoUserPanel');
            
            /*
             * Remove login panel
             */
            $('#displayLogin').remove();
            
            /*
             * Display register panel
             */
            leftContent = '<li><input id="givenName" class="input-text" type="text" placeholder="' + self.translate('_givenName') + '"/></li>' +
                          '<li><input id="lastName" class="input-text" type="text" placeholder="' + self.translate('_lastName') + '"/></li>' +
                          '<li><input id="userName" class="input-text" type="text" placeholder="' + self.translate('_userName') + '"/></li>';
            
            rightContent = '<li><input id="userEmail" class="input-text" type="text" placeholder="' + self.translate('_email') + '"/></li>' +
                          '<li><input id="userPassword1" class="input-password" type="password" placeholder="' + self.translate('_password') + '"/></li>' +
                          '<li><input id="userPassword2" class="input-password" type="password" placeholder="' + self.translate('_retypePassword') + '"/></li>';
            
            bottomContent = '<p><a class="button register">' + self.translate('_createAccount') + '</a></p><p><a class="signIn">' + self.translate('_back') + '</a></p>';
            
            $userPanel.append('<div class="row" id="displayRegister"><form class="nice" action="#"><div class="large-6 columns"><ul class="no-bullet">' + leftContent + '</ul></div><div class="large-6 columns"><ul class="no-bullet">' + rightContent + '</ul>' + bottomContent + '</div></form></div>');
            
            $('#givenName').focus();
            $('#userPassword2').keypress(function (e) {
                if (e.which === 13) {
                    $('.register').trigger('click');
                    return false;
                }
            });
            
            $('.signIn').click(function(e){
                e.preventDefault;
                self.displayLogin();
                return false;
            });
            
            $('.register').click(function(e){
                e.preventDefault;
                var username = $('#userName').val(), password1 = $('#userPassword1').val(), password2 = $('#userPassword2').val(), email = $('#userEmail').val();
                if (!email || !self.isEmailAdress(email)) {
                    self.message('Email is not valid');
                    return false;
                }
                if (!username) {
                    self.message('Username is mandatory');
                    return false;
                }
                if (!password1 || !password2 || password1 !== password2) {
                    self.message('Passwords differ');
                    return false;
                }
                
                window.R.ajax({
                    url: window.R.restoUrl + 'auth/register.php',
                    async: true,
                    type: 'POST',
                    dataType: "json",
                    data: {
                        email:email,
                        password:password1,
                        username:username,
                        givenname:$('#givenName').val(),
                        lastname:$('#lastName').val()
                    },
                    success: function(json) {
                        if (json && json.status === 'OK') {
                            self.message(json.message);
                            self.hideUserPanel();
                        }
                        else {
                            self.message(json.ErrorMessage);
                        }
                    },
                    error: function(e) {
                        if (e.responseJSON) {
                            self.message(e.responseJSON.ErrorMessage);
                        }
                        else {
                            self.message('Error : cannot register');
                        }
                    }
                }, true);
                return false;
            });
            
        },
        
        /**
         * Check if a string is a valid email adress
         * 
         * @param {String} str
         */
        isEmailAdress: function (str) {
            if (!str || str.length === 0) {
                return false;
            }
            var pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,4}$/;
            return pattern.test(str);
            
        }
    };

    /**
     * Collection/Resources management
     */
    window.R.Admin = {
        
        /**
         * Update admin actions
         */
        updateAdminActions: function(collection) {

            var self = this;

            /*
             * Actions
             */
            $('.deactiveCollection').each(function() {
                $(this).click(function(e) {
                    e.stopPropagation();
                    self.removeCollection($(this).attr('collection'), false);
                    return false;
                });
            });
            $('.removeCollection').each(function() {
                $(this).click(function(e) {
                    e.stopPropagation();
                    self.removeCollection($(this).attr('collection'), true);
                    return false;
                });
            });
            $('.updateCollection').each(function() {
                $(this).click(function(e) {
                    e.stopPropagation();
                    self.updateCollection($(this).attr('collection'));
                    return false;
                });
            });
            
            /*
             * Drag&Drop listener
             */
            var $ddzone = $('#dropZone');
            $ddzone.bind('dragleave',
                function(e) {
                    $ddzone.removeClass('hover');
                    e.preventDefault();
                    e.stopPropagation();
            }).bind('dragover',
                    function(e) {
                        $ddzone.addClass('hover');
                        e.preventDefault();
                        e.stopPropagation();
            }).bind('drop', function(e) {

                $ddzone.removeClass('hover');

                /*
                 * Stop events
                 */
                e.preventDefault();
                e.stopPropagation();

                /*
                 * HTML5 : get dataTransfer object
                 */
                var files = e.originalEvent.dataTransfer.files,
                    type = $(this).hasClass('_dropCollection') ? 'collection' : 'resource';
                
                /*
                 * If there is no file, we assume that user dropped
                 * something else...a url for example !
                 */
                if (files.length === 0) {
                    window.R.message("Error : drop a file");
                }
                else if (files.length > 1) {
                    window.R.message("Error : drop only one file at a time");
                }
                /* 
                 * Apparently "application/json" mimeType is not detected on Windows
                else if (type === 'collection' && files[0].type.toLowerCase() !== "application/json") {
                    window.R.message("Error : drop a json file");
                }
                */
                /*
                 * User dropped a file
                 */
                else {

                    var reader = new FileReader();

                    /*
                     * Parse and display result
                     */
                    reader.onloadend = function(e) {
                        try {
                            if (type === 'collection') {
                                self.addCollection($.parseJSON(e.target.result));
                            }
                            else {
                                self.addResource(e.target.result, collection);
                            }
                        }
                        catch (e) {
                            if (type === 'collection') {
                                window.R.message('Error : collection description is not valid JSON');
                            }
                            else {
                                window.R.message('Error : resource file is not valid');
                            }
                        }
                    };
                    reader.readAsText(files[0]);
                    
                }
            });
        },
        
        /**
         * Add a collection
         * 
         * @param {object} description
         */
        addCollection: function(description) {

            if (window.confirm('Add collection ' + description.name + ' ?')) {
                window.R.ajax({
                    url: window.R.restoUrl,
                    async: true,
                    type: 'POST',
                    dataType: "json",
                    data: {
                        data: encodeURIComponent(JSON.stringify(description))
                    },
                    success: function(obj, textStatus, XMLHttpRequest) {
                        if (XMLHttpRequest.status === 200) {
                            window.location = window.R.restoUrl;
                        }
                        else {
                            window.R.message(textStatus);
                        }
                    },
                    error: function(e) {
                        window.R.message(e.responseJSON['ErrorMessage']);
                    }
                }, true);
            }
        },
        
        /**
         * Add a resource
         * 
         * @param {object} resource
         * @param {string} collection
         * 
         */
        addResource: function(resource, collection) {
            
            if (!collection || !resource) {
                return false;
            }
            
            if (window.confirm('Add resource to collection ' + collection + ' ?')) {
                window.R.ajax({
                    url: window.R.restoUrl + '/' + collection + '/',
                    async: true,
                    type: 'POST',
                    dataType: "json",
                    data: {
                        data: encodeURIComponent(resource)
                    },
                    success: function(obj, textStatus, XMLHttpRequest) {
                        if (XMLHttpRequest.status === 200) {
                            window.R.message('Resource added');
                        }
                        else {
                            window.R.message(textStatus);
                        }
                    },
                    error: function(e) {
                        window.R.message(e.responseJSON['ErrorMessage']);
                    }
                }, true);
            }
            
            return true;
        },
        
        /**
         * Logically remove a collection
         * 
         * @param {type} collection
         * @param {boolean} physical - true to physically delete the collection
         *                             (otherwise collection is logically delete)
         */
        removeCollection: function(collection, physical) {

            if (window.confirm('Remove collection ' + collection + ' ?')) {
                window.R.ajax({
                    url: window.R.restoUrl + collection + (physical ? '?physical=true' : ''),
                    async: true,
                    type: 'DELETE',
                    dataType: "json",
                    success: function(obj, textStatus, XMLHttpRequest) {
                        if (XMLHttpRequest.status === 200) {
                            window.R.message(obj['Message']);
                            $('#_' + collection).fadeOut(300, function() {
                                $(this).remove();
                            });
                        }
                        else {
                            alert(textStatus);
                        }
                    },
                    error: function(e) {
                        alert(e.responseJSON['ErrorMessage']);
                    }
                }, true);
            }

        },
        
        /**
         * Update a collection
         * 
         * @param {type} collection
         */
        updateCollection: function(collection) {

        }
    };
    
})(window);
