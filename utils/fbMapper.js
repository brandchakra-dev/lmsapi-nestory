exports.mapFacebookLead = (fbData) => {
    const mapped = {
      name: "",
      phone: "",
      email: "",
      details: ""
    };
  
    fbData.field_data.forEach((field) => {
      const key = field.name;
      const value = field.values?.[0];
  
      switch (key) {
        case "full_name":
        case "name":
          mapped.name = value;
          break;
  
        case "phone_number":
        case "phone":
          mapped.phone = value;
          break;
  
        case "email":
          mapped.email = value;
          break;
  
        default:
          mapped.details += `${key}: ${value}\n`;
      }
    });
  
    return mapped;
  };