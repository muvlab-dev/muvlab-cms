const pageWithHero = {
  fields: {},
  components: {
    hero: {
      uid: 'images.hero-section',
      repeatable: false,
      fields: {
        desktop: { w: 2720, h: 1264, fit: 'cover', position: 'center' },
        tablet: { w: 1456, h: 1786, fit: 'cover', position: 'center' },
        mobile: { w: 1456, h: 1786, fit: 'cover', position: 'center' },
      }
    }
  }
}

module.exports = {
  'api::instructor.instructor': {
    avatar:  { w: 464, h: 544, fit: 'cover', position: 'center' },
    picture: { w: 840, h: 492, fit: 'cover', position: 'center' }
  },
  'api::class.class': {
    thumbnail: { w: 650, h: 784, fit: 'cover', position: 'center' },
  },
  'api::home-page.home-page': {
    fields: {},
    components: {
      hero: {
        uid: 'images.hero-home-page',
        repeatable: false,
        fields: {
          mobile_image: { w: 1456, h: 1786, fit: 'cover', position: 'center' },
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
