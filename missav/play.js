<script type="text/javascript">
        window.isPublished = true

        window.hash = window.location.hash.slice(1)

        if (window.hash.includes('internal')) {
            window.scenario = window.hash
            window.currentRecommendId = null
        } else if (window.hash.includes('_') && (window.hash.split('_')[0].length === 32 || window.hash.split('_')[0].length === 36)) {
            window.scenario = window.hash.split('_')[1]
            window.currentRecommendId = window.hash.split('_')[0]
        } else if (window.hash && (window.hash.length === 32 || window.hash.length === 36)) {
            window.scenario = null
            window.currentRecommendId = window.hash
        } else {
            window.scenario = null
            window.currentRecommendId = null
        }

        if (window.hash && ! window.hash.includes(':')) {
            window.history.replaceState(null, null, ' ')
        }

        window.dataLayer.push({
            event: 'videoVisit',
            item: {
                dvd_id: 'jul-530-uncensored-leak',
            },
        })

        if (window.scenario) {
            window.dataLayer.push({
                event: 'recommendationVisit',
                recommendation: {
                    scenario: window.scenario,
                },
            })
        }

        document.addEventListener('DOMContentLoaded', () => {
            let source
            let isPreviewing = false

                            eval(function(p,a,c,k,e,d){e=function(c){return c.toString(36)};if(!''.replace(/^/,String)){while(c--){d[c.toString(a)]=k[c]||c.toString(a)}k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c])}}return p}('f=\'8://7.6/5-4-3-2-1/e.0\';d=\'8://7.6/5-4-3-2-1/c/9.0\';b=\'8://7.6/5-4-3-2-1/a/9.0\';',16,16,'m3u8|458deb87594e|b8d5|4922|89bb|4dbfa06c|com|surrit|https|video|1280x720|source1280|842x480|source842|playlist|source'.split('|'),0,{}))
            
            const video = document.querySelector('video.player')

            const initialPlayerEvent = () => {
                setTimeout(() => {
                    window.player.speed = 2

                    setTimeout(() => {
                        window.player.speed = 1
                    }, 50)
                }, 50)

                window.player.on('play', () => {
                    if (! hasPlayed) {
                        if (window.hls) {
                            window.hls.startLoad(-1)
                        }

                        hasPlayed = true

                        window.dataLayer.push({
                            event: 'videoPlay',
                            item: {
                                dvd_id: 'jul-530-uncensored-leak',
                            },
                        })
                    }
                })

                window.player.on('enterfullscreen', () => {
                    screen.orientation.lock('landscape').catch(() => {})

                    setHlsDefaultLevel()
                })

                window.player.on('exitfullscreen', () => {
                    screen.orientation.lock('portrait').catch(() => {})

                    setHlsDefaultLevel()
                })

                let converted = false

                window.player.on('progress', (event) => {
                    if (! window.isPublished || converted || ! window.user_uuid) {
                        return
                    }

                    if (event.timeStamp > 100000) {
                        converted = true

                        window.recombeeClient.send(new recombee.AddPurchase(window.user_uuid, 'jul-530-uncensored-leak', {
                            cascadeCreate: false,
                            recommId: window.currentRecommendId,
                        }))
                    }
                })

                if (! window.hls) {
                    let resetPlayerCallback = null

                    window.player.on('stalled', () => {
                        let source = window.player.source
                        let oldCurrentTime = 0
                        let newCurrentTime = 0

                        if (window.player.playing) {
                            oldCurrentTime = window.player.currentTime

                            if (resetPlayerCallback) {
                                clearTimeout(resetPlayerCallback)
                            }

                            resetPlayerCallback = setTimeout(oldCurrentTime => {
                                newCurrentTime = window.player.currentTime

                                if (oldCurrentTime === newCurrentTime) {
                                    let presevedTime = window.player.currentTime

                                    window.player.once('canplay', () => {
                                        window.player.currentTime = presevedTime
                                    })

                                    video.src = ''
                                    video.src = source

                                    window.player.play()
                                }
                            }, 500, oldCurrentTime)
                        }
                    })
                }

                document.querySelector('[data-plyr=mute]').addEventListener('click', () => {
                    if (! window.player.muted && window.player.volume === 0) {
                        window.player.volume = 100
                    }
                })
            }

            const setHlsDefaultLevel = () => {
                if (! window.hls) {
                    return
                }

                window.hls.currentLevel = window.hls.levels.findIndex((level, levelIndex) =>
                    level.width + 20 > window.innerWidth || levelIndex === window.hls.levels.length - 1
                )
            }

            let hasPlayed = false

            let playerSettings = {
                controls: [
                    'play-large',
                    'rewind',
                    'play',
                    'fast-forward',
                    'progress',
                    'current-time',
                    'duration',
                    'mute',
                    'captions',
                    'settings',
                    'pip',
                    'fullscreen',
                    'volume',
                ],
                fullscreen: {
                    enabled: true,
                    fallback: true,
                    iosNative: true,
                    container: null,
                },
                speed: {
                    selected: 1,
                    options: [0.25, 0.5, 1, 1.25, 1.5, 2],
                },
                i18n: {
                    speed: 'スピード',
                    normal: '普通',
                    quality: '品質',
                    qualityLabel: {
                        0: '自動',
                    },
                },
                thumbnail: {
                                            enabled: true,
                        pic_num: 3651,
                        width: 300,
                        height: 168,
                        col: 6,
                        row: 6,
                        offsetX: 0,
                        offsetY: 0,
                        urls: ["https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_0.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_1.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_2.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_3.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_4.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_5.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_6.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_7.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_8.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_9.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_10.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_11.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_12.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_13.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_14.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_15.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_16.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_17.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_18.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_19.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_20.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_21.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_22.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_23.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_24.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_25.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_26.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_27.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_28.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_29.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_30.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_31.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_32.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_33.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_34.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_35.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_36.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_37.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_38.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_39.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_40.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_41.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_42.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_43.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_44.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_45.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_46.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_47.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_48.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_49.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_50.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_51.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_52.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_53.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_54.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_55.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_56.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_57.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_58.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_59.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_60.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_61.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_62.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_63.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_64.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_65.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_66.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_67.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_68.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_69.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_70.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_71.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_72.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_73.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_74.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_75.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_76.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_77.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_78.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_79.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_80.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_81.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_82.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_83.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_84.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_85.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_86.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_87.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_88.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_89.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_90.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_91.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_92.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_93.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_94.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_95.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_96.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_97.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_98.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_99.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_100.jpg","https:\/\/nineyu.com\/4dbfa06c-89bb-4922-b8d5-458deb87594e\/seek\/_101.jpg"],
                                    },
                keyboard: {
                    focused: true,
                    global: true,
                },
                            };

            if (isPreviewing) {
                window.player = new Plyr(video, playerSettings)

                initialPlayerEvent()
            } else if (! Hls.isSupported()) {
                window.player = new Plyr(video, playerSettings)

                video.src = source842

                initialPlayerEvent()
            } else if (
                window.navigator.userAgent.includes('iPad') ||
                (window.navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
            ) {
                window.player = new Plyr(video, playerSettings)

                video.src = source1280

                initialPlayerEvent()
            } else {
                let parsedManifest = false

                window.hls = new Hls({
                    autoStartLoad: true,
                    maxBufferSize: 1 * 1000 * 1000,
                })

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (! parsedManifest && data.networkDetails.status === 429) {
                        hls.loadSource(source)
                    }
                })

                hls.loadSource(source)

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    parsedManifest = true

                    window.player = new Plyr(video, {
                        quality: {
                            forced: true,
                            default: 0,
                            options: [...window.hls.levels.map(level => level.height).reverse(), 0],
                            onChange: height => {
                                if (height === 0) {
                                    setHlsDefaultLevel()
                                } else {
                                    window.hls.levels.forEach((level, levelIndex) => {
                                        if (level.height === height) {
                                            window.hls.currentLevel = levelIndex
                                        }
                                    })
                                }
                            },
                        },
                        ...playerSettings,
                    })

                    initialPlayerEvent()
                })

                hls.attachMedia(video)
            }

            document.addEventListener('visibilitychange', () => {
                if (window.player && document.hidden) {
                    window.player.pause()
                }
            })

            document.addEventListener('blur', () => {
                if (window.player) {
                    window.player.pause()
                }
            })

            window.addEventListener('blur', () => {
                if (window.player) {
                    window.player.pause()
                }
            })

            window.addEventListener('resize', () => {
                setHlsDefaultLevel()
            })

            window.addEventListener('orientationchange', () => {
                setHlsDefaultLevel()
            })
        })
    </script>