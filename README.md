# MMM-PSTrophies
This module shows your online Playstation Friends along with what they are playing

## Installation

In your terminal, go to your MagicMirror's Module folder:
```
cd ~/MagicMirror/modules
```

Clone this repository:
```
git clone https://github.com/benexus/MMM-PSTrophies.git
```

## Configuration

```javascript
modules: [
  {
    module: 'MMM-PSTrophies',
    position: 'top_right',
    config: {
      code: "" // See below for initial authentication
    }
  }
]
```

## Initial Authentication


- Open Chrome and display the Developer Tools.
- Copy the url from the `authorize.txt` file included in this repo and navigate to it.
- Log in with your playstation credentials.
- Look on the developer settings for a redirect that will fail and copy the value from the query parameter `code`.
- Paste the code on the configuration file.


## Future Improvements / Enhancements

- Better HTML/CSS
- Customization
- Pagination for large lists
- Option for friends/messages
- Notifications

**Have an idea? Start a [discussion](https://github.com/benexus/MMM-PSTrophies/discussions), and I may implement it.**

**Found a bug? Submit an [issue](https://github.com/benexus/MMM-PSTrophies/issues) and I'll take a look at it.**
