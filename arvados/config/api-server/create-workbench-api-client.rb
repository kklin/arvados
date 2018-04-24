include CurrentApiClient
act_as_system_user do
  wb = ApiClient.new(:url_prefix => "8.8.8.8")
  wb.save!
  wb.update_attributes!(is_trusted: true)
end
