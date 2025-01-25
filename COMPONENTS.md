# Component Library Documentation

This document outlines all available components in the library, organized by category. Each component includes a description and example usage.

## Table of Contents
- [Hero Components](#hero-components)
- [Section Components](#section-components)
- [Form Components](#form-components)
- [Card Components](#card-components)
- [Media Components](#media-components)
- [Generic Components](#generic-components)
- [Utility Components](#utility-components)

## Hero Components

### Banner Hero
A full-width banner hero section with text overlay.

**Properties:**
- background_image: Image URL for hero background
- heading: Main heading text
- text: Supporting text content
- button: Object containing button properties

**Example:**
```
bookshop "bannerHero"
    background_image: "/images/hero.jpg"
    heading: "Welcome to Our Site"
    text: "Discover amazing things with us"
    button:
        text: "Get Started"
        link: "/contact"
        style: "primary"
```

### Full Image Hero
Full-screen hero section with image background.

**Properties:**
- background_image: Full-screen background image
- overlay: Boolean to enable dark overlay
- heading: Hero heading
- text: Description text

**Example:**
```
bookshop "fullImageHero"
    background_image: "/images/hero-bg.jpg"
    overlay: true
    heading: "Bold Statement"
    text: "Detailed description goes here"
```

### Left Right Hero
Split-screen hero with content on one side and image on the other.

## Section Components

### Side By Side
Two-column layout for content and images.

### Simple CTA
Clean call-to-action section.

### Image Gallery
Grid-based image gallery with optional lightbox.

## Form Components

### Text Input
Standard text input field with label and validation.

**Properties:**
- label: Input field label
- name: Input name attribute
- required: Boolean for required field
- placeholder: Placeholder text
- helper_text: Helper text below input

**Example:**
```
bookshop "form/textInput"
    label: "Full Name"
    name: "full_name"
    required: true
    placeholder: "Enter your name"
    helper_text: "Please enter your legal name"
```

### Email Input
Email-specific input with validation.

### Simple Form
Complete form component with configurable inputs.

**Properties:**
- heading: Form title
- description: Form description
- form_inputs: Array of input components
- submit_text: Submit button text

**Example:**
```
bookshop "simpleForm"
    heading: "Contact Us"
    description: "Send us a message"
    form_inputs:
        - _bookshop_name: "form/textInput"
          label: "Name"
          name: "name"
          required: true
        - _bookshop_name: "form/emailInput"
          label: "Email"
          name: "email"
          required: true
    submit_text: "Send Message"
```

## Card Components

### Blog Card
Card component for blog post previews.

**Properties:**
- title: Post title
- excerpt: Post excerpt
- image: Featured image
- date: Publication date
- author: Author information
- categories: Array of categories
- link: Post URL

**Example:**
```
bookshop "generic/blog/defaultCard"
    title: "10 Tips for Success"
    excerpt: "Learn the secrets to achieving your goals..."
    image: "/images/blog/post-1.jpg"
    date: "2024-03-15"
    author:
        name: "John Doe"
        avatar: "/images/authors/john.jpg"
    categories: ["Business", "Growth"]
    link: "/blog/10-tips-for-success"
```

### Pricing Card
Card component for pricing plans.

## Media Components

### Video Embed
Responsive video embed component.

**Properties:**
- url: Video URL (YouTube, Vimeo, etc.)
- title: Video title for accessibility
- autoplay: Boolean for autoplay
- controls: Boolean for player controls

**Example:**
```
bookshop "videoEmbed"
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    title: "Amazing Video"
    autoplay: false
    controls: true
```

### Image Modal
Clickable image with modal overlay.

## Generic Components

### Button
Reusable button component with multiple styles.

**Properties:**
- text: Button label
- link: Button URL
- style: Button style (primary, secondary, outline)
- size: Button size (small, medium, large)
- icon: Optional icon name

**Example:**
```
bookshop "button"
    text: "Learn More"
    link: "/about"
    style: "primary"
    size: "medium"
    icon: "arrow-right"
```

### Heading
Standard heading component with multiple styles.

## Utility Components

### Text Contrast Script
Utility for ensuring text readability on dynamic backgrounds.

**Properties:**
- selector: CSS selector for target elements
- threshold: Contrast ratio threshold
- lightClass: Class applied for light backgrounds
- darkClass: Class applied for dark backgrounds

**Example:**
```
bookshop "util/textContrastScript"
    selector: ".hero-text"
    threshold: 4.5
    lightClass: "text-dark"
    darkClass: "text-light"
```

### ID Scroll Event
Handles smooth scrolling to page sections.

---

For implementation details and advanced usage, refer to the individual component documentation in the components directory. Each component may have additional properties and configurations not listed here.
