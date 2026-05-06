#!/usr/bin/env ruby

kind = ARGV.fetch(0, "iphone")

preferred_devices = {
  "iphone" => [
    "iPhone 17 Pro",
    "iPhone 17",
    "iPhone 16 Pro",
    "iPhone 16",
    "iPhone 16e",
    "iPhone 15 Pro"
  ],
  "ipad" => [
    "iPad Pro 13-inch (M5)",
    "iPad Pro 11-inch (M5)",
    "iPad Air 13-inch (M3)",
    "iPad mini (A17 Pro)",
    "iPad (A16)"
  ]
}

abort("Usage: select-simulator.rb [iphone|ipad]") unless preferred_devices.key?(kind)

available_devices = `xcrun simctl list devices available`.each_line.each_with_object([]) do |line, devices|
  match = line.match(/^\s+(.+)\s+\(([0-9A-F-]+)\)\s+\((Booted|Shutdown)\)\s*$/)
  next unless match

  name = match[1]
  next unless kind == "iphone" ? name.start_with?("iPhone") : name.start_with?("iPad")

  devices << name
end.uniq

selected_device =
  preferred_devices.fetch(kind).find { |device| available_devices.include?(device) } ||
  available_devices.first

abort("No available #{kind} simulator found.") unless selected_device

puts selected_device
