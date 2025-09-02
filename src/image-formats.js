const pageWithHero = {
  fields: {},
  components: {
    hero: {
      uid: 'images.hero-section',
      repeatable: false,
      fields: {
        desktop: { w: 1920, h: 1080, fit: 'cover', position: 'center' },
        tablet: { w: 1920, h: 1080, fit: 'cover', position: 'center' },
        mobile: { w: 1920, h: 1080, fit: 'cover', position: 'center' },
      }
    }
  }
}

module.exports = {
  'api::instructor.instructor': {
    avatar:  { w: 500, h: 500, fit: 'cover', position: 'center' },
    picture: { w: 500, h: 500, fit: 'cover', position: 'center' }
  },
  'api::class.class': {
    thumbnail: { w: 500, h: 500, fit: 'cover', position: 'center' },
  },
  'api::home-page.home-page': {
    fields: {},
    components: {
      hero: {
        uid: 'images.hero-home-page',
        repeatable: false,
        fields: {
          desktop_images: { w: 1920, h: 1080, fit: 'cover', position: 'center' },
          mobile_images: { w: 1920, h: 1080, fit: 'cover', position: 'center' },
        }
      }
    }
  },
  'api::about-us.about-us': pageWithHero,
  'api::for-business.for-business': pageWithHero,
  'api::widget-event.widget-event': pageWithHero,
  'api::muvlab-widget.muvlab-widget': pageWithHero,
  'api::schedule-widget.schedule-widget': pageWithHero,
};
